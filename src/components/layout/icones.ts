import type { LucideIcon } from 'lucide-react'
import { Calculator, Clock, FolderOpen, Settings, Users } from 'lucide-react'
import type { Module } from '@/lib/permissions'

/**
 * Icône de chaque module.
 *
 * Volontairement séparé de `config/navigation.ts` : une icône Lucide est un
 * composant React, et un composant ne franchit pas la frontière serveur →
 * client. La navigation transporte le nom du module ; le client résout l'icône
 * ici.
 */
export const ICONE_MODULE: Readonly<Record<Module, LucideIcon>> = {
  crm: Users,
  cv: FolderOpen,
  heures: Clock,
  calculateur: Calculator,
  admin: Settings,
}
