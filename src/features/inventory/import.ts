import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import { Alert, Platform } from 'react-native';

import { requireSupabase, shouldUseSupabase, readLocalSnapshot, writeLocalSnapshot, getSessionUserId, makeId } from './repository';
import { VariationType } from './types';

interface ExcelRow {
  Marca?: string;
  Modelo?: string;
  Coluna?: number;
  Linha?: number;
  Cor?: string;
  Silicone?: number;
  Colorida?: number;
  Carteira?: number;
}

export async function pickAndImportExcel() {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
      ],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, message: 'Operacao cancelada' };
    }

    let workbook: XLSX.WorkBook;

    const asset = result.assets[0];
    const isCsv = asset.name.toLowerCase().endsWith('.csv') || asset.mimeType === 'text/csv';

    let data: any[] = [];

    if (isCsv) {
      // Manual CSV Parser to guarantee we correctly split by comma or semicolon
      let text = '';
      if (Platform.OS === 'web') {
        if (asset.file) text = await asset.file.text();
        else text = await (await fetch(asset.uri)).text();
      } else {
        text = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'utf8' });
      }

      const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
      if (lines.length > 0) {
        const separator = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(separator).map(h => h.trim());
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(separator);
          const row: any = {};
          for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = values[j] !== undefined ? values[j].trim() : '';
          }
          data.push(row);
        }
      }
    } else {
      if (Platform.OS === 'web') {
        let arrayBuffer: ArrayBuffer;
        if (asset.file) {
          arrayBuffer = await asset.file.arrayBuffer();
        } else {
          const response = await fetch(asset.uri);
          arrayBuffer = await response.arrayBuffer();
        }
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
      } else {
        const fileUri = asset.uri;
        const b64 = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });
        workbook = XLSX.read(b64, { type: 'base64' });
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);
    }

    if (!data || data.length === 0) {
      return { success: false, message: 'Planilha vazia ou em formato invalido.' };
    }

    await processImport(data);
    return { success: true, message: 'Importacao concluida com sucesso!' };
  } catch (error: any) {
    console.error('[GSM Stock Case] Erro na importacao:', error);
    return { success: false, message: 'Ocorreu um erro: ' + (error?.message || String(error)) };
  }
}

async function processImport(data: ExcelRow[]) {
  const isCloud = await shouldUseSupabase();
  const userId = await getSessionUserId();

  if (isCloud) {
    const client = requireSupabase();
    // Batch processing could be complex with Supabase RPCs without a dedicated bulk import RPC.
    // For simplicity and to reuse our robust logic, we can insert row by row, or group them.
    // Since this is an admin tool, we'll do it sequentially or build a payload.
    // A better approach for bulk: fetch all brands and models first to minimize network requests.
    
    const { data: existingBrands } = await client.from('brands').select('id, name');
    const { data: existingModels } = await client.from('models').select('id, name, brand_id, column_index, row_index');

    let currentBrands = existingBrands || [];
    let currentModels = existingModels || [];

    for (const row of data) {
      const rowKeys = Object.keys(row);
      
      const marcaKey = rowKeys.find(k => k.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() === 'marca');
      const modeloKey = rowKeys.find(k => k.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() === 'modelo');
      
      if (!marcaKey || !modeloKey || !row[marcaKey as keyof typeof row] || !row[modeloKey as keyof typeof row]) {
        console.warn('[GSM Stock Case] Linha ignorada (Cloud) por falta de Marca ou Modelo:', row);
        continue;
      }

      const brandName = String(row[marcaKey as keyof typeof row]).trim();
      const modelName = String(row[modeloKey as keyof typeof row]).trim();
      
      const colKey = rowKeys.find(k => k.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() === 'coluna');
      const col = colKey && row[colKey as keyof typeof row] ? Number(row[colKey as keyof typeof row]) : 1;
      
      const linKey = rowKeys.find(k => k.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() === 'linha');
      const lin = linKey && row[linKey as keyof typeof row] ? Number(row[linKey as keyof typeof row]) : 1;
      
      const colorKey = rowKeys.find(k => k.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() === 'cor');
      const color = colorKey && row[colorKey as keyof typeof row] ? String(row[colorKey as keyof typeof row]).trim() : 'Padrão';

      // 1. Find or create Brand
      let brand = currentBrands.find((b) => b.name.toLowerCase() === brandName.toLowerCase());
      if (!brand) {
        const { data: newBrand, error: brandErr } = await client
          .from('brands')
          .insert({ name: brandName })
          .select('id, name')
          .single();
        
        if (!brandErr && newBrand) {
          brand = newBrand;
          currentBrands.push(brand);
        } else {
          continue; // Skip row on error
        }
      }

      // 2. Find or create Model
      let model = currentModels.find((m) => m.name.toLowerCase() === modelName.toLowerCase() && m.brand_id === brand?.id);
      if (!model) {
        const { data: newModel, error: modelErr } = await client
          .from('models')
          .insert({
            brand_id: brand.id,
            name: modelName,
            column_index: col,
            row_index: lin,
            created_by: userId,
          })
          .select('id, name, brand_id, column_index, row_index')
          .single();
        
        if (!modelErr && newModel) {
          model = newModel;
          currentModels.push(model);
        } else {
          continue;
        }
      }

      // 3. Upsert Inventory
      const variations: VariationType[] = ['silicone', 'colorida', 'carteira'];
      
      for (const variation of variations) {
        // Find key case-insensitively and ignoring whitespace
        const matchedKey = rowKeys.find(k => k.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() === variation.toLowerCase());
        const qty = matchedKey ? (Number(row[matchedKey as keyof typeof row]) || 0) : 0;

        if (qty > 0) {
          const colorKey = rowKeys.find(k => k.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() === 'cor');
          const color = colorKey && row[colorKey as keyof typeof row] 
            ? String(row[colorKey as keyof typeof row]).trim() 
            : 'Padrão';
          
          console.log(`[GSM Stock Case] Processando Variação: ${variation}, Qtde Planilha: ${qty}, Cor: ${color}`);

          // Get existing quantity to calculate delta
          const { data: existingInv } = await client
            .from('inventory')
            .select('quantity')
            .eq('model_id', model.id)
            .eq('variation', variation)
            .eq('color', color)
            .maybeSingle();

          const currentQty = existingInv?.quantity || 0;
          
          // Se o estoque atual é 0 e a planilha diz 5, delta = +5 (ajuste)
          // Se o estoque atual é 3 e a planilha diz 5, delta = +2 (ajuste)
          // Se o estoque atual é 7 e a planilha diz 5, delta = -2 (defeito)
          // Com a RPC, ele atualiza corretamente a tabela inventory e logs, e faz bypass no RLS.
          const delta = qty - currentQty;
          console.log(`[GSM Stock Case] - Estoque Atual: ${currentQty}, Delta Calculado: ${delta}`);
          
          if (delta !== 0) {
             console.log(`[GSM Stock Case] - Chamando RPC apply_inventory_log`);
            const { error: rpcErr } = await client.rpc('apply_inventory_log', {
              p_model_id: model.id,
              p_variation: variation,
              p_color: color,
              p_delta: delta,
              p_reason: delta > 0 ? 'ajuste' : 'defeito',
              p_note: 'Importação via Excel/CSV',
            });
            
            if (rpcErr) {
              console.warn(`[GSM Stock Case] Falha ao aplicar log para ${model.name} (${variation}):`, rpcErr);
              throw new Error(`Erro ao salvar estoque para ${model.name}: ` + rpcErr.message);
            } else {
              console.log(`[GSM Stock Case] - RPC executada com sucesso!`);
            }
          }
        }
      }
    }
  } else {
    // Local processing
    const snapshot = await readLocalSnapshot();
    
    for (const row of data) {
      const rowKeys = Object.keys(row);
      
      const marcaKey = rowKeys.find(k => k.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() === 'marca');
      const modeloKey = rowKeys.find(k => k.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() === 'modelo');
      
      if (!marcaKey || !modeloKey || !row[marcaKey] || !row[modeloKey]) {
        console.warn('[GSM Stock Case] Linha ignorada (Local) por falta de Marca ou Modelo:', row);
        continue;
      }

      const brandName = String(row[marcaKey]).trim();
      const modelName = String(row[modeloKey]).trim();
      
      const colKey = rowKeys.find(k => k.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() === 'coluna');
      const col = colKey && row[colKey] ? Number(row[colKey]) : 1;
      
      const linKey = rowKeys.find(k => k.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() === 'linha');
      const lin = linKey && row[linKey] ? Number(row[linKey]) : 1;
      
      const colorKey = rowKeys.find(k => k.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() === 'cor');
      const color = colorKey && row[colorKey] ? String(row[colorKey]).trim() : 'Padrão';

      let brand = snapshot.brands.find((b) => b.name.toLowerCase() === brandName.toLowerCase());
      if (!brand) {
        brand = { id: makeId('brand'), name: brandName };
        snapshot.brands.push(brand);
      }

      let model = snapshot.models.find((m) => m.name.toLowerCase() === modelName.toLowerCase() && m.brandId === brand?.id);
      if (!model) {
        model = {
          id: makeId('model'),
          brandId: brand.id,
          name: modelName,
          column: col,
          row: lin,
          criticalThresholds: {},
        };
        snapshot.models.push(model);
      }

      const variations: VariationType[] = ['silicone', 'colorida', 'carteira'];

      for (const variation of variations) {
        // Find key case-insensitively and ignoring whitespace
        const matchedKey = rowKeys.find(k => k.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() === variation.toLowerCase());
        const qty = matchedKey ? (Number(row[matchedKey as keyof typeof row]) || 0) : 0;

        if (qty > 0) {
          const existing = snapshot.inventory.find(
            (inv) => inv.modelId === model?.id && inv.variation === variation && inv.color === color
          );
          
          const currentQty = existing ? existing.quantity : 0;
          const delta = qty - currentQty;

          if (delta !== 0) {
            if (existing) {
              existing.quantity = qty;
            } else {
              snapshot.inventory.push({
                id: makeId('inv'),
                modelId: model.id,
                variation,
                color,
                quantity: qty,
              });
            }

            snapshot.logs.push({
              id: makeId('log'),
              modelId: model.id,
              variation,
              color,
              delta: delta,
              reason: delta > 0 ? 'ajuste' : 'defeito',
              note: 'Importação via Excel/CSV (Local)',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    await writeLocalSnapshot(snapshot);
  }
}
