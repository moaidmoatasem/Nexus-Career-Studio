// Reference-bound provenance auditor: every bullet must cite a real vault item,
// and every metric it claims must exist in that item's verified metrics.
export interface TailoredBullet {
  vault_item_id: string;
  tailored_text: string;
  verified_metrics: string[];
  aligned_skills: string[];
}
export interface ProvenanceViolation {
  bulletIndex: number;
  vaultItemId: string;
  reason: "INVALID_VAULT_ID" | "UNVERIFIED_METRIC";
  detail: string;
}
export interface VaultLike {
  id: string;
  title: string;
  metrics: string[];
}

export function validateBulletProvenance(bullets: TailoredBullet[], vault: VaultLike[]) {
  const map = new Map(vault.map((v) => [v.id, v]));
  const violations: ProvenanceViolation[] = [];
  const valid: TailoredBullet[] = [];
  bullets.forEach((b, i) => {
    const rec = map.get(b.vault_item_id);
    if (!rec) {
      violations.push({ bulletIndex: i, vaultItemId: b.vault_item_id, reason: "INVALID_VAULT_ID", detail: `Cited unknown vault item "${b.vault_item_id}".` });
      return;
    }
    let ok = true;
    for (const m of b.verified_metrics ?? []) {
      const c = m.toLowerCase().trim();
      if (!rec.metrics.some((vm) => { const v = vm.toLowerCase().trim(); return v.includes(c) || c.includes(v); })) {
        ok = false;
        violations.push({ bulletIndex: i, vaultItemId: b.vault_item_id, reason: "UNVERIFIED_METRIC", detail: `Metric "${m}" is not in "${rec.title}".` });
      }
    }
    if (ok) valid.push(b);
  });
  return { isValid: violations.length === 0, violations, validBullets: valid };
}
