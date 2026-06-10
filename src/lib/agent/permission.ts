import type { PermissionAction, PermissionRule } from './types'

function wildcardMatch(pattern: string, value: string): boolean {
  if (pattern === '*') return true

  const parts = pattern.split('*')
  if (parts.length === 1) return pattern === value

  if (!value.startsWith(parts[0])) return false
  if (!parts[parts.length - 1] && !value.endsWith(parts[parts.length - 1])) return false

  let remaining = value.slice(parts[0].length)
  for (let i = 1; i < parts.length - 1; i++) {
    const idx = remaining.indexOf(parts[i])
    if (idx === -1) return false
    remaining = remaining.slice(idx + parts[i].length)
  }

  if (parts[parts.length - 1]) {
    return remaining.endsWith(parts[parts.length - 1])
  }

  return true
}

export function evaluatePermission(
  permission: string,
  pattern: string,
  ...rulesets: PermissionRule[][]
): PermissionAction {
  let result: PermissionAction | undefined

  for (const ruleset of rulesets) {
    for (const rule of ruleset) {
      if (wildcardMatch(rule.permission, permission) && wildcardMatch(rule.pattern, pattern)) {
        result = rule.action
      }
    }
  }

  return result ?? 'ask'
}

export const DEFAULT_PERMISSIONS: PermissionRule[] = [
  { permission: 'read', pattern: '*', action: 'allow' },
  { permission: 'search', pattern: '*', action: 'allow' },
  { permission: 'list', pattern: '*', action: 'allow' },
  { permission: 'edit', pattern: '*', action: 'ask' },
  { permission: 'create', pattern: '*', action: 'ask' },
  { permission: 'delete', pattern: '*', action: 'deny' },
]
