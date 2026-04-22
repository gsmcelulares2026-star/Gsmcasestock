# GSMCaseStock

Aplicativo Android em React Native (Expo + TypeScript) para controle de estoque
de capas de celular em um painel fisico de 45 colunas x 7 linhas.

## Stack

- Expo + React Native + TypeScript
- React Navigation
- TanStack Query
- Supabase
- AsyncStorage para cache local/offline
- FlashList para virtualizacao do grid horizontal

## Rodando o projeto

```bash
npm install
npm run start
```

## Variaveis de ambiente

Copie `.env.example` para `.env` e preencha:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Sem essas variaveis, o app sobe em modo demo com seed local persistida em
`AsyncStorage`, o que ajuda no desenvolvimento offline.

## Supabase

O arquivo [supabase/schema.sql](/g:/dev/GsmStock/supabase/schema.sql) inclui:

- tabelas de dominio
- `profiles` ligado ao `auth.users`
- `RLS policies`
- trigger de `updated_at`
- funcao segura para movimentacao de estoque
- view e funcao para dashboard

Quando `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` estiverem preenchidos:

- o app abre tela de login/cadastro
- sessao fica persistida no dispositivo
- leitura passa a vir do Supabase
- movimentacao de estoque usa a RPC `apply_inventory_log(...)`
- cadastro de marcas/modelos respeita o papel do usuario (`owner` e `manager`)

Para liberar cadastro de catalogo na primeira conta, promova o usuario no Supabase:

```sql
update public.profiles
set role = 'owner'
where id = 'USER_ID_AQUI';
```
