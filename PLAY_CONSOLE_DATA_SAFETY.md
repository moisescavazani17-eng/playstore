# Google Play — Data Safety / Segurança dos dados

Este arquivo descreve o comportamento implementado no código atual. Use como referência ao preencher a Play Console e revise novamente antes de cada lançamento.

## Funcionamento sem conta

O aplicativo pode ser usado sem conta. Nesse modo, dados como clientes, produtos, orçamentos, vendas, recibos, configurações e identidade visual permanecem somente no aparelho e não são enviados ao backend do Marcenaria Pro.

## Dados coletados quando o usuário opta pela nuvem

### Informações pessoais
- **E-mail:** usado para criar/autenticar a conta de nuvem.

Finalidades:
- gerenciamento da conta;
- autenticação;
- backup, restauração e sincronização.

### Conteúdo do usuário
Quando o usuário usa Pro + Nuvem, o backup pode conter os dados que ele cadastrou no aplicativo, incluindo dados comerciais e informações de clientes inseridas por ele.

Finalidades:
- backup;
- restauração;
- sincronização entre dispositivos.

### Informações de compra
O backend recebe/consulta informações técnicas necessárias para validar assinatura:
- produto;
- base plan;
- status;
- vencimento;
- renovação;
- referência de pedido;
- hash do purchase token.

O aplicativo não recebe nem armazena número de cartão, senha bancária ou dados completos do meio de pagamento.

Finalidades:
- controle de acesso premium;
- prevenção de fraude;
- suporte ao ciclo de vida da assinatura.

## Compartilhamento / terceiros

Serviços envolvidos:
- **Google Play:** distribuição, cobrança e gestão de assinaturas.
- **Supabase:** autenticação e armazenamento da nuvem opcional.

Não há SDK de anúncios nem venda de dados a anunciantes no código atual.

## Segurança

- transmissão via HTTPS;
- RLS por usuário no Supabase;
- nuvem exige entitlement Pro + Nuvem validado no servidor;
- purchase token bruto não é persistido no banco;
- sessão e token necessário ao vínculo são protegidos no Android Keystore;
- credenciais administrativas não são incluídas no APK.

## Exclusão de dados

Há:
- caminho dentro do aplicativo;
- recurso Web externo funcional.

URL externa:
`https://vssbgmzkprhsbpxdtald.supabase.co/functions/v1/playstore-account-delete`

A exclusão da conta remove conta Auth, backup de nuvem e entitlement vinculado à conta. Dados armazenados exclusivamente no dispositivo são controlados pelo usuário e podem ser removidos limpando os dados do app/desinstalando-o.

## Política de privacidade

`https://vssbgmzkprhsbpxdtald.supabase.co/functions/v1/playstore-privacy`

## Revisar antes de enviar

Se forem adicionados no futuro analytics, crash reporting, anúncios, localização, contatos, câmera, arquivos automáticos, identificadores de publicidade ou outros SDKs que coletem dados, este documento e a declaração da Play Console deverão ser atualizados.
