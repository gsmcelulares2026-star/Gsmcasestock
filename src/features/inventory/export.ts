import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { exportCsv } from './repository';
import { InventorySnapshot } from './types';

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function shareInventoryCsv(snapshot: InventorySnapshot) {
  const csv = await exportCsv(snapshot);
  const uri = `${FileSystem.cacheDirectory}hookstock-${formatDate(new Date())}.csv`;

  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(uri);
}

export async function shareHistoryPdf(snapshot: InventorySnapshot) {
  const html = `
    <html>
      <body style="font-family: Arial; padding: 24px;">
        <h1>GSM Case Stock - Relatorio de Saidas</h1>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="border: 1px solid #ccc; padding: 8px;">Data</th>
              <th style="border: 1px solid #ccc; padding: 8px;">Modelo</th>
              <th style="border: 1px solid #ccc; padding: 8px;">Variacao</th>
              <th style="border: 1px solid #ccc; padding: 8px;">Motivo</th>
              <th style="border: 1px solid #ccc; padding: 8px;">Delta</th>
            </tr>
          </thead>
          <tbody>
            ${snapshot.logs
              .map(
                (log) => {
                  const model = snapshot.models.find((m) => m.id === log.modelId);
                  const brand = snapshot.brands.find((b) => b.id === model?.brandId);
                  const modelLabel = escapeHtml(`${brand?.name ?? ''} ${model?.name ?? log.modelId}`.trim());
                  return `
                  <tr>
                    <td style="border: 1px solid #ccc; padding: 8px;">${new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                    <td style="border: 1px solid #ccc; padding: 8px;">${modelLabel}</td>
                    <td style="border: 1px solid #ccc; padding: 8px; text-transform: capitalize;">${escapeHtml(log.variation)}</td>
                    <td style="border: 1px solid #ccc; padding: 8px; text-transform: capitalize;">${escapeHtml(log.reason)}</td>
                    <td style="border: 1px solid #ccc; padding: 8px;">${log.delta}</td>
                  </tr>`;
                },
              )
              .join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri);
}
