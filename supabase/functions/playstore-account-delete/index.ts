import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const PUBLISHABLE_KEY = (() => {
  const modern = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed.default) return String(parsed.default);
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
})();

function secretKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed.default) return String(parsed.default);
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function htmlPage() {
  const fnUrl = SUPABASE_URL + "/functions/v1/playstore-account-delete";
  const authUrl = SUPABASE_URL + "/auth/v1/token?grant_type=password";
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Excluir conta - Orçamentos & Gestão</title>
<style>
body{font-family:Arial,sans-serif;background:#071722;color:#f4f7f9;margin:0;padding:24px}
main{max-width:620px;margin:auto;background:#0d2634;border:1px solid #29495a;border-radius:16px;padding:22px}
h1{margin-top:0}p{line-height:1.55;color:#c6d4dc}label{display:block;margin:12px 0 5px}
input{width:100%;box-sizing:border-box;padding:12px;border-radius:9px;border:1px solid #355568;background:#081c28;color:#fff}
button{width:100%;margin-top:15px;padding:12px;border:0;border-radius:10px;font-weight:700;background:#f1d5d8;color:#5c1720;cursor:pointer}
.note{font-size:13px;color:#9fb4c0}.ok{color:#9be2b7}.err{color:#ffb6bd}
</style>
</head>
<body><main>
<h1>Excluir conta e dados da nuvem</h1>
<p>Esta página permite excluir permanentemente a conta de nuvem do Orçamentos & Gestão. A exclusão remove a conta de acesso, o backup/sincronização armazenado na nuvem e o vínculo da assinatura com essa conta.</p>
<p class="note">Os dados que estiverem somente no seu aparelho não podem ser apagados por esta página. Para removê-los, desinstale o aplicativo ou limpe os dados do app no Android.</p>
<p class="note"><strong>Importante:</strong> excluir a conta de nuvem não cancela uma assinatura Google Play ativa. O cancelamento da renovação deve ser feito na área de assinaturas da Google Play.</p>
<label>E-mail</label><input id="email" type="email" autocomplete="username">
<label>Senha</label><input id="password" type="password" autocomplete="current-password">
<button id="deleteBtn">Excluir minha conta permanentemente</button>
<p id="status" class="note"></p>
<script>
const authUrl=${JSON.stringify(authUrl)};
const fnUrl=${JSON.stringify(fnUrl)};
const apiKey=${JSON.stringify(PUBLISHABLE_KEY)};
document.getElementById('deleteBtn').onclick=async()=>{
  const email=document.getElementById('email').value.trim();
  const password=document.getElementById('password').value;
  const status=document.getElementById('status');
  if(!email||!password){status.className='err';status.textContent='Informe e-mail e senha.';return}
  if(!confirm('Excluir permanentemente sua conta e os dados salvos na nuvem? Esta ação não pode ser desfeita.'))return;
  status.className='note';status.textContent='Validando sua conta...';
  try{
    const login=await fetch(authUrl,{method:'POST',headers:{'Content-Type':'application/json','apikey':apiKey},body:JSON.stringify({email,password})});
    const session=await login.json();
    if(!login.ok||!session.access_token)throw new Error('E-mail ou senha inválidos.');
    const del=await fetch(fnUrl,{method:'POST',headers:{'Content-Type':'application/json','apikey':apiKey,'Authorization':'Bearer '+session.access_token},body:'{}'});
    const result=await del.json();
    if(!del.ok)throw new Error(result.detail||result.error||'Falha ao excluir a conta.');
    status.className='ok';status.textContent='Conta e dados da nuvem excluídos com sucesso.';
    document.getElementById('email').value='';document.getElementById('password').value='';
  }catch(e){status.className='err';status.textContent=e.message||String(e)}
};
</script>
</main></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return new Response(htmlPage(), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    }});
  }
  if (req.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return Response.json({ error: "authentication_required" }, { status: 401 });
    const jwt = authHeader.slice(7).trim();
    const adminKey = secretKey();
    if (!SUPABASE_URL || !adminKey) return Response.json({ error: "backend_not_configured" }, { status: 503 });

    const admin = createClient(SUPABASE_URL, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data.user) return Response.json({ error: "invalid_session" }, { status: 401 });

    const userId = data.user.id;

    const { error: snapError } = await admin.from("playstore_snapshots").delete().eq("user_id", userId);
    if (snapError) throw snapError;

    const { error: entitlementError } = await admin.from("playstore_entitlements").delete().eq("user_id", userId);
    if (entitlementError) throw entitlementError;

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return Response.json({ ok: true }, { headers: { "access-control-allow-origin": "*" } });
  } catch (error) {
    console.error("playstore-account-delete", error);
    const detail = error instanceof Error ? error.message : "unknown_error";
    return Response.json({ error: "account_delete_failed", detail }, {
      status: 500,
      headers: { "access-control-allow-origin": "*" },
    });
  }
});