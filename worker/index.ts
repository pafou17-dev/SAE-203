import handler from "vinext/server/fetch-handler";
import { consultation, pagesOrigin } from "../lib/consultation";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, async () => {
      const path = new URL(request.url).pathname;
      if (path === '/api/consultation' || path.startsWith('/api/consultation/')) {
        const origin=request.headers.get('origin');
        const fromPages=origin===pagesOrigin;
        const cors=(response:Response)=>{
          if(fromPages){
            response.headers.set('access-control-allow-origin',pagesOrigin);
            response.headers.set('vary','Origin');
          }
          return response;
        };
        if(request.method==='OPTIONS'){
          if(!fromPages)return new Response(null,{status:403});
          return new Response(null,{status:204,headers:{
            'access-control-allow-origin':pagesOrigin,'access-control-allow-methods':'GET, POST, OPTIONS',
            'access-control-allow-headers':'Content-Type, X-Cycleup-Visitor','access-control-max-age':'600','vary':'Origin',
          }});
        }
        try {
          if (!env.DB) throw new Error('Missing consultation database');
          return cors(await consultation(request, env.DB));
        } catch (error) {
          console.error('Consultation request failed', error);
          return cors(Response.json({ error: 'Le service est momentanément indisponible. Réessayez dans un instant.' }, { status: 503, headers: { 'cache-control': 'no-store' } }));
        }
      }
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return handler.fetch(request, env, ctx);
    });
  },
};

export default worker;
