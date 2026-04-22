# HookStock

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
