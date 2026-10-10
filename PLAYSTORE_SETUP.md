# Versão Play Store

Este repositório é exclusivo da versão Android distribuída pela Google Play.

## Arquitetura
- Local-first: os dados principais continuam no aparelho.
- Conta não é obrigatória.
- Gratuito: armazenamento local e recursos principais.
- Profissional: logo, identidade visual e PDFs personalizados.
- Pro + Nuvem: personalização + backup/sincronização opcional.
- White Label: build separada para nome e ícone próprios.

## Produtos preparados na Google Play Console
- plano_profissional_mensal
- plano_pro_nuvem_mensal

Antes do lançamento público, a compra também deve ser validada em backend com a Google Play Developer API.

## Nuvem
A versão Play Store usa public.playstore_snapshots, separada das tabelas das versões pessoal/comercial. O arquivo supabase_setup_playstore.sql contém a tabela e as políticas RLS.

## Build
O workflow build-playstore.yml compila APK de teste e AAB para a branch playstore-dev.
