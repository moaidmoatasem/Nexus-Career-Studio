import { TailoredBullet, VaultItem } from '../types/career';

export interface ProvenanceValidationResult {
  isValid: boolean;
  violations: Array<{
    bulletIndex: number;
    vaultItemId: string;
    reason: 'INVALID_VAULT_ID' | 'UNVERIFIED_METRIC' | 'HALLUCINATED_SKILL';
    detail: string;
  }>;
  validBulletsCount: number;
  totalBulletsCount: number;
}

export function validateBulletProvenance(
  bullets: TailoredBullet[],
  vaultItems: VaultItem[]
): ProvenanceValidationResult {
  const vaultMap = new Map<string, VaultItem>();
  vaultItems.forEach(item => vaultMap.set(item.id, item));

  const violations: ProvenanceValidationResult['violations'] = [];
  let validBulletsCount = 0;

  bullets.forEach((bullet, idx) => {
    let bulletValid = true;
    const record = vaultMap.get(bullet.vault_item_id);

    // 1. Assert foreign key exists in user vault
    if (!record) {
      bulletValid = false;
      violations.push({
        bulletIndex: idx,
        vaultItemId: bullet.vault_item_id,
        reason: 'INVALID_VAULT_ID',
        detail: `The generated bullet cited phantom vault_item_id "${bullet.vault_item_id}" which does not exist in your Career Vault.`,
      });
      return;
    }

    // 2. Assert all verified_metrics in bullet exist verbatim or near-verbatim in vault record
    for (const metric of bullet.verified_metrics || []) {
      const cleanMetric = metric.toLowerCase().trim();
      const metricFound = (record.metrics || []).some(m => {
        const cleanVaultMetric = m.toLowerCase().trim();
        return cleanVaultMetric.includes(cleanMetric) || cleanMetric.includes(cleanVaultMetric);
      });

      if (!metricFound) {
        bulletValid = false;
        violations.push({
          bulletIndex: idx,
          vaultItemId: bullet.vault_item_id,
          reason: 'UNVERIFIED_METRIC',
          detail: `Metric claim "${metric}" was not found in the verified achievements of "${record.title}".`,
        });
      }
    }

    if (bulletValid) {
      validBulletsCount++;
    }
  });

  return {
    isValid: violations.length === 0,
    violations,
    validBulletsCount,
    totalBulletsCount: bullets.length,
  };
}
