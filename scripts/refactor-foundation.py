from pathlib import Path
import json, re

root = Path(__file__).resolve().parent.parent
def write(name, value):
    p=root/name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(value.strip()+"\n", encoding="utf-8")

for folder in ['app','components','lib','services','tests','scripts']:
    for p in (root/folder).rglob('*'):
        if p.suffix in ['.ts','.tsx']:
            s=p.read_text(encoding='utf-8').replace('@/generated/prisma','@/app/generated/prisma').replace('../src/generated/prisma','../app/generated/prisma')
            p.write_text(s,encoding='utf-8')
for name, before, after in [('tsconfig.json','./src/*','./*'),('vitest.config.ts','./src','./'),('components.json','src/app/globals.css','app/globals.css'),('.gitignore','/src/generated/prisma/','/app/generated/prisma/'),('prisma/schema.prisma','../src/generated/prisma','../app/generated/prisma')]:
    p=root/name
    p.write_text(p.read_text().replace(before,after),encoding='utf-8')
with (root/'.gitignore').open('a') as f: f.write('\n/.backups/\n/artifacts/implementation-qa/\n')
for folder in ['hooks','stores','assets','types','docs','services/admin','services/uploads','services/viewer','lib/validation','lib/cloudinary','components/common','components/dashboard']:
    (root/folder).mkdir(parents=True,exist_ok=True)
for folder in ['hooks','stores','assets']: write(folder+'/.gitkeep','')
write('.prettierrc',json.dumps({'endOfLine':'lf','semi':False,'singleQuote':False,'tabWidth':2,'trailingComma':'es5','printWidth':80,'plugins':['prettier-plugin-tailwindcss'],'tailwindStylesheet':'app/globals.css','tailwindFunctions':['cn','cva']},indent=2))
write('types/index.ts','''export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  code?: string
  errors?: Record<string, string[]>
}''')
write('lib/api-client-error.ts','''import { isAxiosError } from "axios"
import type { ApiResponse } from "@/types"
export class ApiClientError extends Error {
  constructor(message: string, public readonly status?: number, public readonly code?: string, public readonly fieldErrors?: Record<string, string[]>) { super(message); this.name = "ApiClientError" }
}
export function toApiClientError(error: unknown, fallback = "Request failed") {
  if(error instanceof ApiClientError) return error
  if(isAxiosError<ApiResponse<never>>(error)) return new ApiClientError(error.response?.data?.message ?? fallback, error.response?.status, error.response?.data?.code, error.response?.data?.errors)
  return new ApiClientError(error instanceof Error ? error.message : fallback)
}''')
write('lib/axios.ts','''import axios from "axios"
import { toApiClientError } from "@/lib/api-client-error"
const api = axios.create({ baseURL: "/api", withCredentials: true, timeout: 30000 })
api.interceptors.response.use(response => response, error => Promise.reject(toApiClientError(error)))
export default api''')
write('lib/api-client.ts','''import axios from "@/lib/axios"
import type { ApiResponse } from "@/types"
import { ApiClientError } from "@/lib/api-client-error"
export { ApiClientError } from "@/lib/api-client-error"
export type { ApiResponse } from "@/types"
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await axios.request<ApiResponse<T>>({ url: path, method: init?.method ?? "GET", data: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body })
  const body = response.data
  if(!body.success || body.data === undefined) throw new ApiClientError(body.message ?? "Request failed", response.status, body.code, body.errors)
  return body.data
}''')
write('components/common/MaterialSymbol.tsx','''import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"
export function MaterialSymbol({icon, filled, className, ...props}: HTMLAttributes<HTMLSpanElement> & {icon:string; filled?:boolean}) {
 return <span aria-hidden="true" className={cn("material-symbols-outlined select-none leading-none",filled && "filled",className)} {...props}>{icon}</span>
}''')
icons=set()
for p in list((root/'components').rglob('*.tsx'))+list((root/'app').rglob('*.tsx')):
    s=p.read_text(encoding='utf-8')
    for match in re.finditer(r'import\s*\{([^}]+)\}\s*from\s*["\']lucide-react["\']',s):
        for part in match.group(1).split(','):
            name=part.strip()
            if name: icons.add(name)
    p.write_text(s.replace('from "lucide-react"','from "@/components/common/icons"'),encoding='utf-8')
mapping={'Menu':'menu','X':'close','ArrowLeft':'arrow_back','ArrowRight':'arrow_forward','ChevronLeft':'chevron_left','ChevronRight':'chevron_right','ChevronDown':'expand_more','Plus':'add','Search':'search','Loader2':'progress_activity','Trash2':'delete','Film':'movie','Tv':'tv','Eye':'visibility','EyeOff':'visibility_off','FilePenLine':'edit_document','UsersRound':'group','Users':'group','LibraryBig':'video_library','LayoutDashboard':'dashboard','Database':'category','ExternalLink':'open_in_new','Save':'save','ShieldCheck':'verified_user','ImageIcon':'image','PlayCircle':'play_circle','Play':'play_arrow','Pause':'pause','Clapperboard':'movie','BookOpen':'menu_book','FileCheck2':'fact_check','Tags':'sell','Edit3':'edit','Info':'info','Check':'check','CheckCircle2':'check_circle','LogOut':'logout','Upload':'upload','Volume2':'volume_up','VolumeX':'volume_off','Maximize':'fullscreen','Minimize':'fullscreen_exit','Heart':'favorite','Bookmark':'bookmark','BookmarkPlus':'bookmark_add','UserRound':'person','CircleUserRound':'account_circle','SlidersHorizontal':'tune','RotateCcw':'replay','RotateCw':'forward_10'}
lines=['import type { HTMLAttributes } from "react"','import { MaterialSymbol } from "./MaterialSymbol"','type Props = HTMLAttributes<HTMLSpanElement> & {fill?:string; strokeWidth?:number; size?:number}']
for name in sorted(icons):
    symbol=mapping.get(name,re.sub(r'(?<!^)(?=[A-Z])','_',name).lower())
    lines.append(f'export function {name}({{fill, strokeWidth, size, ...props}}: Props) {{ void strokeWidth; return <MaterialSymbol icon="{symbol}" filled={{fill === "currentColor"}} style={{{{fontSize:size, ...props.style}}}} {{...props}} /> }}')
write('components/common/icons.tsx','\n'.join(lines))
write('components/providers/providers.tsx','''"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { Toaster } from "sonner"
export function Providers({children}:{children:ReactNode}) {
 const [client] = useState(()=>new QueryClient({defaultOptions:{queries:{staleTime:30000,retry:1,refetchOnWindowFocus:false},mutations:{retry:false}}}))
 return <QueryClientProvider client={client}>{children}<Toaster position="top-center" richColors /></QueryClientProvider>
}''')
write('components/providers/app-providers.tsx','export { Providers as AppProviders } from "./providers"')
p=root/'app/layout.tsx'
s=p.read_text().replace('import { AppProviders } from "@/components/providers/app-providers";','import { Providers } from "@/components/providers/providers";').replace('<AppProviders>','<Providers>').replace('</AppProviders>','</Providers>')
s=s.replace('<body className="antialiased">','<head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" /></head><body className="antialiased">')
p.write_text(s)
p=root/'app/globals.css'
p.write_text(p.read_text()+'''\n.material-symbols-outlined { font-family: "Material Symbols Outlined"; font-weight: normal; font-style: normal; font-size: 24px; display:inline-block; line-height:1; letter-spacing:normal; text-transform:none; white-space:nowrap; word-wrap:normal; direction:ltr; -webkit-font-smoothing:antialiased; font-feature-settings:"liga"; }
.material-symbols-outlined.filled {font-variation-settings:"FILL" 1;}
.gv-admin {--background:#f8f9ff; --primary:#8d4b00; --primary-hover:#6b3700; --muted:#eff3ff; --border:#e1e7f2; background:var(--background); color:#121c2a; font-size:14px;}
.gv-panel {background:#eff3ff; border-radius:12px; padding:24px;}
.gv-table {width:100%; text-align:left; border-collapse:collapse; font-size:13px;}
.gv-table th {background:#dfe9fc; padding:16px; font-size:11px; text-transform:uppercase; letter-spacing:.04em; white-space:nowrap;}
.gv-table td {padding:16px; border-bottom:1px solid #eff3ff; background:white;}
.gv-table tbody tr:hover td {background:#f8f9ff;}
.gv-field {display:block; width:100%; border:1px solid #d1d5db; border-radius:6px; padding:10px 12px; background:white; font-size:14px; min-height:42px;}
.gv-label {display:grid; gap:8px; font-size:12px; font-weight:600;}
.gv-action {display:inline-flex; gap:8px; align-items:center; justify-content:center; background:#ffdcc3; color:#6b3700; padding:10px 16px; border-radius:6px; font-weight:700; font-size:13px;}
.gv-action:disabled {opacity:.5; cursor:wait;}
.gv-action.secondary {background:#dfe9fc; color:#121c2a;}
.gv-action.danger {background:#fee2e2; color:#b91c1c;}
''')
p=root/'components/auth/sign-out-button.tsx'
s=p.read_text().replace('import { useRouter }','import { useQueryClient } from "@tanstack/react-query";\nimport { useRouter }').replace('const router = useRouter();','const router = useRouter(); const queryClient=useQueryClient();').replace('await authClient.signOut();','await authClient.signOut(); queryClient.clear();')
p.write_text(s)
print('Foundation paths, contracts, providers, icons and configuration migrated.')
