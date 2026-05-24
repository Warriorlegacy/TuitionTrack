import type { Database } from './types'

// Test if Database types are properly structured
export type _Test1 = Database['public']['Tables']['students']['Row']
export type _Test2 = Database['public']['Tables']['homework']['Row']