import { createClient } from '@supabase/supabase-js';

const url = 'https://gxehjzofidfbqbfpfvbh.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4ZWhqem9maWRmYnFiZnBmdmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDE5MjgsImV4cCI6MjA4NzYxNzkyOH0.rzJ19HkhLHD7MAMYuuNf7M5SxGk2oQLVKcAXx9TDXEE';

const supabase = createClient(url, anonKey);

async function checkAdmin() {
  // Step 1: Sign in as admin@gsm.com to get the session
  console.log('=== Tentando login com admin@gsm.com ===\n');
  
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'admin@gsm.com',
    password: 'admin123', // tentativa com senha comum
  });

  if (signInError) {
    console.log('Erro no login (tentativa 1 - admin123):', signInError.message);
    
    // Tenta outra senha comum
    const { data: signInData2, error: signInError2 } = await supabase.auth.signInWithPassword({
      email: 'admin@gsm.com',
      password: 'Admin123!',
    });
    
    if (signInError2) {
      console.log('Erro no login (tentativa 2 - Admin123!):', signInError2.message);
      console.log('\n⚠️  Não consegui fazer login automático.');
      console.log('Para verificar o perfil manualmente, execute no SQL Editor do Supabase:\n');
      console.log(`  SELECT p.id, p.full_name, p.role, p.is_active, u.email`);
      console.log(`  FROM public.profiles p`);
      console.log(`  JOIN auth.users u ON u.id = p.id`);
      console.log(`  WHERE u.email = 'admin@gsm.com';`);
      console.log('\nPara garantir acesso total (role = owner), execute:\n');
      console.log(`  UPDATE public.profiles`);
      console.log(`  SET role = 'owner', is_active = true`);
      console.log(`  WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@gsm.com');`);
      return;
    }
    
    await checkProfile(signInData2);
    return;
  }

  await checkProfile(signInData);
}

async function checkProfile(signInData) {
  const userId = signInData.user.id;
  console.log('✅ Login bem-sucedido!');
  console.log('   User ID:', userId);
  console.log('   Email:', signInData.user.email);
  console.log('');

  // Step 2: Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('id', userId)
    .single();

  if (profileError) {
    console.log('❌ Erro ao buscar perfil:', profileError.message);
    console.log('   Possível causa: perfil não foi criado automaticamente pelo trigger.');
    return;
  }

  console.log('=== Perfil do Usuário ===');
  console.log('   Nome:', profile.full_name || '(não definido)');
  console.log('   Role:', profile.role);
  console.log('   Ativo:', profile.is_active);
  console.log('');

  // Step 3: Analyze permissions
  const roleHierarchy = { owner: 3, manager: 2, operator: 1 };
  const level = roleHierarchy[profile.role] || 0;

  console.log('=== Análise de Permissões ===');
  console.log('');
  
  const permissions = [
    { name: 'Visualizar estoque (brands, models, inventory)', requires: 'operator', minLevel: 1 },
    { name: 'Registrar entradas/saídas (apply_inventory_log)', requires: 'operator', minLevel: 1 },
    { name: 'Visualizar histórico (logs)', requires: 'operator', minLevel: 1 },
    { name: 'Criar/editar marcas (brands INSERT/UPDATE/DELETE)', requires: 'manager', minLevel: 2 },
    { name: 'Criar/editar modelos (models INSERT/UPDATE/DELETE)', requires: 'manager', minLevel: 2 },
    { name: 'Gerenciar perfis de outros usuários', requires: 'manager', minLevel: 2 },
    { name: 'Acesso total ao sistema (owner)', requires: 'owner', minLevel: 3 },
  ];

  let allOk = true;
  for (const perm of permissions) {
    const hasAccess = level >= perm.minLevel && profile.is_active;
    const icon = hasAccess ? '✅' : '❌';
    console.log(`   ${icon} ${perm.name} (requer: ${perm.requires})`);
    if (!hasAccess) allOk = false;
  }

  console.log('');

  if (!profile.is_active) {
    console.log('⚠️  ATENÇÃO: Conta está INATIVA! Nenhuma operação será permitida.');
    console.log('   Solução: UPDATE profiles SET is_active = true WHERE id = \'' + userId + '\';');
  } else if (profile.role === 'owner') {
    console.log('🎉 Tudo certo! admin@gsm.com tem ACESSO TOTAL ao sistema (role: owner).');
  } else if (profile.role === 'manager') {
    console.log('⚠️  admin@gsm.com é "manager" — tem quase tudo, mas não é "owner".');
    console.log('   Para dar acesso total:');
    console.log(`   UPDATE profiles SET role = 'owner' WHERE id = '${userId}';`);
  } else {
    console.log('⚠️  admin@gsm.com é apenas "operator" — tem acesso limitado!');
    console.log('   Para dar acesso total:');
    console.log(`   UPDATE profiles SET role = 'owner' WHERE id = '${userId}';`);
  }

  await supabase.auth.signOut();
}

checkAdmin().catch(console.error);
