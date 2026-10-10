# Marcenaria Pro - Play Store

Repositório exclusivo da versão Android destinada à Google Play.

## Estrutura

- Aplicativo Android local-first.
- Plano gratuito sem conta obrigatória.
- Plano Profissional com identidade visual e logo da empresa.
- Plano Pro + Nuvem com backup e sincronização opcional.
- Google Play Billing para assinaturas.
- Backend de sincronização isolado em `playstore_snapshots`.

## Build

O workflow `.github/workflows/build-playstore.yml` compila:

- APK de teste
- AAB para publicação na Google Play

## Importante

Este repositório não contém a versão comercial/Windows nem os workflows e arquivos de assinatura do projeto antigo.
