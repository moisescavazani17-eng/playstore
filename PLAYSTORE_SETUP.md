# Orçamentos & Gestão — configuração de produção da Google Play

Este repositório contém somente a versão Android destinada à Google Play.

## Arquitetura

- **Local-first:** clientes, produtos, serviços, orçamentos, vendas e configurações ficam no aparelho.
- **Sem conta obrigatória:** o plano Gratuito funciona sem login e sem internet.
- **Backup local:** exportação e restauração de arquivo pelo seletor nativo do Android.
- **PDF offline:** jsPDF é empacotado no APK/AAB.
- **Profissional:** personalização da marca, logo no app/PDF, cores e slogan.
- **Pro + Nuvem:** tudo do Profissional + conta opcional, backup e sincronização.
- **Nuvem protegida por entitlement:** a RLS do Supabase exige assinatura Pro + Nuvem validada no servidor.

## Google Play Billing

Biblioteca: Google Play Billing 9.1.0.

Criar estas assinaturas na Play Console:

### Produto 1
- Product ID: `plano_profissional`
- Nome sugerido: Profissional
- Base plan mensal: `mensal`
- Base plan anual: `anual`

### Produto 2
- Product ID: `plano_pro_nuvem`
- Nome sugerido: Pro + Nuvem
- Base plan mensal: `mensal`
- Base plan anual: `anual`

Os preços são lidos em tempo real da Google Play e exibidos já localizados. Não há preço fixo no código.

O app suporta:
- nova assinatura;
- mensal e anual;
- restauração de compras;
- upgrade Profissional -> Pro + Nuvem;
- downgrade Pro + Nuvem -> Profissional de forma adiada;
- cancelamento/gerenciamento pela central de assinaturas da Google Play;
- pagamento pendente;
- período de carência;
- assinatura cancelada ainda válida até o vencimento;
- expiração/suspensão sem acesso premium.

## Validação segura de pagamento

A Edge Function `play-billing-verify` valida o purchase token na Google Play Developer API antes de liberar o plano.

Secret obrigatório no Supabase:

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: JSON da service account que possui acesso ao app na Play Console / Android Publisher API.

A função:
- consulta `purchases.subscriptionsv2`;
- confirma o produto e o status;
- reconhece vencimento e renovação;
- acknowledge da compra quando necessário;
- grava somente hash SHA-256 do purchase token no banco;
- impede que uma compra já vinculada a uma conta seja vinculada a outra.

## Real-time Developer Notifications

A Edge Function `google-play-rtdn` mantém o backend atualizado mesmo quando o usuário não abre o app.

Configurar no Google Cloud / Play Console:
- tópico Pub/Sub para RTDN;
- push endpoint:
  `https://vssbgmzkprhsbpxdtald.supabase.co/functions/v1/google-play-rtdn`
- autenticação OIDC no push.

Secrets:
- `GOOGLE_PLAY_RTDN_AUDIENCE`: audience configurada no push;
- `GOOGLE_PLAY_RTDN_PUSH_EMAIL`: e-mail da service account usada para autenticar o push (recomendado).

## Supabase

Executar `supabase_setup_playstore.sql` em um projeto novo quando o backend for separado.

Tabelas:
- `public.playstore_snapshots`
- `public.playstore_entitlements`

Edge Functions versionadas no repositório:
- `supabase/functions/play-billing-verify/index.ts`
- `supabase/functions/google-play-rtdn/index.ts`
- `supabase/functions/playstore-account-delete/index.ts`
- `supabase/functions/playstore-privacy/index.ts`

## Privacidade e exclusão de conta

Política pública:
`https://vssbgmzkprhsbpxdtald.supabase.co/functions/v1/playstore-privacy`

Exclusão externa:
`https://vssbgmzkprhsbpxdtald.supabase.co/functions/v1/playstore-account-delete`

O app também possui exclusão de conta dentro de Configurações.

A exclusão remove:
- usuário do Supabase Auth;
- snapshot/backup de nuvem;
- vínculo do entitlement com a conta.

A assinatura Google Play não é cancelada automaticamente pela exclusão da conta e continua sendo administrada pela Google Play.

## Assinatura do AAB

Nunca versionar a chave de upload.

Secrets esperados no GitHub:
- `PLAYSTORE_KEYSTORE_B64`
- `PLAYSTORE_KEYSTORE_PASSWORD`
- `PLAYSTORE_KEY_ALIAS`
- `PLAYSTORE_KEY_PASSWORD`

O workflow `.github/workflows/build-playstore.yml` pode validar builds sem chave. Em execução manual, use `require_signing=true` para impedir a geração de um release não assinado.

## Aplicativo

- Nome provisório: `Orçamentos & Gestão`
- Package name atual (provisório até definirmos a marca): `com.cavazani.orcamentos.playstore`
- targetSdk: 36
- versionCode: 1
- versionName: 1.0.0
- branch: `main`

## Antes de produção

Itens que dependem de configuração externa e não ficam no código:
1. Criar o app na Play Console com o package name definitivo.
2. Criar os 2 produtos de assinatura e os 4 base plans acima, com preços.
3. Conectar a service account à Play Console e habilitar Android Publisher API.
4. Cadastrar `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` no Supabase.
5. Configurar RTDN/Pub/Sub e os secrets correspondentes.
6. Cadastrar política de privacidade e URL de exclusão na Play Console.
7. Preencher Data Safety conforme `PLAY_CONSOLE_DATA_SAFETY.md`.
8. Configurar a chave de upload nos GitHub Secrets e ativar Play App Signing.
9. Publicar primeiro em Internal testing e testar compra, renovação, upgrade, downgrade, cancelamento e restauração.
