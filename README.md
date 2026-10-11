# Vezora: Orçamentos e Gestão - Android

Repositório exclusivo da versão Android destinada à Google Play, voltada a autônomos, prestadores de serviço e pequenos negócios.

## Estrutura

- Aplicativo Android local-first para clientes, produtos, serviços, orçamentos, vendas e documentos.
- Plano gratuito sem conta obrigatória.
- Plano Profissional com identidade visual e logo do negócio.
- Plano Pro + Nuvem com backup e sincronização opcional entre dispositivos.
- Google Play Billing para assinaturas.
- Backend de sincronização isolado em `playstore_snapshots`.

## Build

O workflow `.github/workflows/build-playstore.yml` compila:

- APK de teste
- AAB para publicação na Google Play

## Importante

Este repositório não contém a versão comercial/Windows nem os workflows e arquivos de assinatura do projeto antigo.

## Repositório independente

A versão Play Store é mantida integralmente neste repositório. Ela não depende de workflows, arquivos de assinatura ou código desktop do repositório Cavazani-Orcamentos.
