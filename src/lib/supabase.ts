import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const configurado = Boolean(url && key);
// Solo clave anon (pública). Nunca la service_role en el front end.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'sin-configurar');
