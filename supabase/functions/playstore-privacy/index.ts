function page() {
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Política de Privacidade - Marcenaria Pro</title>
<style>
body{font-family:Arial,sans-serif;background:#071722;color:#f4f7f9;margin:0;padding:24px}
main{max-width:780px;margin:auto;background:#0d2634;border:1px solid #29495a;border-radius:16px;padding:24px}
h1,h2{color:#fff}p,li{color:#c6d4dc;line-height:1.6}a{color:#b9ddf0}.box{background:#0a202c;border:1px solid #29495a;border-radius:10px;padding:12px}
</style></head><body><main>
<h1>Política de Privacidade — Marcenaria Pro</h1>
<p><strong>Última atualização: 10 de outubro de 2026.</strong></p>
<p>O Marcenaria Pro é um aplicativo de orçamento e gestão desenvolvido com funcionamento local como padrão. Esta política explica quais dados podem ser processados, para quais finalidades e quais opções de controle estão disponíveis.</p>

<h2>1. Dados armazenados somente no aparelho</h2>
<p>Sem ativar a nuvem, os dados de uso do aplicativo — como clientes, produtos, orçamentos, vendas, recibos, configurações e identidade visual — são armazenados localmente no dispositivo. Esses dados não são enviados ao nosso servidor apenas pelo uso normal do plano local.</p>

<h2>2. Conta e nuvem opcionais</h2>
<p>O recurso Pro + Nuvem é opcional. Quando o usuário cria uma conta, processamos o endereço de e-mail utilizado no cadastro e o conteúdo que ele decide sincronizar, como backup dos dados do aplicativo. Esses dados são usados somente para autenticação, backup, restauração e sincronização entre dispositivos.</p>

<h2>3. Assinaturas e pagamentos</h2>
<p>Assinaturas digitais são processadas pela Google Play. O Marcenaria Pro não recebe nem armazena número de cartão, senha bancária ou dados completos do meio de pagamento. Para liberar e manter os recursos pagos, processamos informações técnicas da assinatura, como produto contratado, período do plano, situação da assinatura, data de validade e uma referência técnica protegida da compra.</p>

<h2>4. Como usamos os dados</h2>
<ul>
<li>Executar as funções solicitadas pelo usuário.</li>
<li>Autenticar a conta opcional de nuvem.</li>
<li>Manter backup, restauração e sincronização.</li>
<li>Validar o direito de acesso a recursos pagos.</li>
<li>Prevenir fraude e uso indevido das assinaturas.</li>
<li>Atender requisitos legais e de segurança aplicáveis.</li>
</ul>

<h2>5. Compartilhamento e prestadores</h2>
<p>Utilizamos serviços de infraestrutura necessários ao funcionamento do produto, incluindo Google Play para distribuição e cobrança e Supabase para autenticação e armazenamento dos recursos de nuvem. Não vendemos dados pessoais a anunciantes e o aplicativo não depende de publicidade comportamental.</p>

<h2>6. Segurança</h2>
<p>O acesso à nuvem é protegido por autenticação e regras de acesso por usuário. Credenciais administrativas e chaves privadas não são incluídas no aplicativo. Tokens sensíveis armazenados no Android usam recursos de proteção do sistema, e o backend valida assinaturas diretamente com a Google Play.</p>

<h2>7. Exclusão da conta</h2>
<p>O usuário pode excluir a conta de nuvem e os dados associados dentro do próprio aplicativo. Também disponibilizamos uma página externa para exclusão. A exclusão remove a conta de autenticação, o backup/sincronização armazenado na nuvem e o vínculo da assinatura com essa conta. Dados que existam somente no aparelho permanecem sob controle do próprio usuário e podem ser removidos limpando os dados do aplicativo ou desinstalando-o.</p>
<p><a href="https://vssbgmzkprhsbpxdtald.supabase.co/functions/v1/playstore-account-delete">Excluir conta e dados da nuvem</a></p>

<h2>8. Retenção</h2>
<p>Dados de nuvem são mantidos enquanto a conta existir ou enquanto forem necessários para a prestação do recurso solicitado. Após uma exclusão de conta concluída, os dados vinculados à conta são removidos. Informações técnicas estritamente necessárias para segurança, prevenção de fraude ou cumprimento legal podem ser retidas somente quando houver fundamento aplicável.</p>

<h2>9. Crianças</h2>
<p>O aplicativo é destinado a profissionais e negócios e não foi projetado especificamente para crianças.</p>

<h2>10. Alterações desta política</h2>
<p>Esta política pode ser atualizada para refletir mudanças do aplicativo, serviços utilizados ou requisitos legais. A versão publicada nesta página será a vigente.</p>

<h2>11. Contato</h2>
<p>Dúvidas sobre privacidade podem ser encaminhadas pelo canal de suporte informado na ficha oficial do Marcenaria Pro na Google Play.</p>

<div class="box"><strong>Resumo:</strong> o app funciona localmente sem conta. A nuvem é opcional e paga. Os pagamentos são processados pela Google Play.</div>
</main></body></html>`;
}

Deno.serve((req) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  return new Response(page(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});