/**
 * Rules API Endpoints (PGP-F2.0)
 *
 * Provides CRUD operations for gallery rules:
 * - GET /api/rules - List all shop rules
 * - GET /api/rules?ruleId=xxx - Get single rule
 * - POST /api/rules - Create new rule
 * - PUT /api/rules - Update existing rule
 * - DELETE /api/rules?ruleId=xxx - Delete rule
 * - POST /api/rules/reorder - Reorder rules
 * - GET /api/rules/settings - Get global settings
 * - PUT /api/rules/settings - Update global settings
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import type { Rule, ShopRulesMetafield } from "~/types/rules";
import { createEmptyRule, validateRule } from "~/types/rules";
import {
  getShopRules,
  saveShopRules,
  getShopRule,
  addShopRule,
  updateShopRule,
  deleteShopRule,
  reorderShopRules,
  updateGlobalSettings,
  updateEvaluationMode,
} from "~/lib/rules/storage.server";

// =============================================================================
// LOADER (GET requests)
// =============================================================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const ruleId = url.searchParams.get("ruleId");
  const action = url.searchParams.get("action");

  try {
    // GET /api/rules/settings
    if (action === "settings") {
      const rules = await getShopRules(admin);
      return json({
        success: true,
        data: {
          globalSettings: rules.globalSettings,
          evaluationMode: rules.evaluationMode,
        },
      });
    }

    // GET /api/rules?ruleId=xxx - Get single rule
    if (ruleId) {
      const rule = await getShopRule(admin, ruleId);
      if (!rule) {
        return json(
          { success: false, error: `Rule not found: ${ruleId}` },
          { status: 404 }
        );
      }
      return json({ success: true, data: rule });
    }

    // GET /api/rules - List all rules
    const rules = await getShopRules(admin);
    return json({
      success: true,
      data: {
        rules: rules.rules,
        globalSettings: rules.globalSettings,
        evaluationMode: rules.evaluationMode,
        totalRules: rules.rules.length,
        activeRules: rules.rules.filter((r) => r.status === "active").length,
      },
    });
  } catch (error) {
    console.error("[Rules API] GET error:", error);
    return json(
      {
        success: false,
        error: "Failed to process rules request",
      },
      { status: 500 }
    );
  }
};

// =============================================================================
// ACTION (POST, PUT, DELETE requests)
// =============================================================================

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const method = request.method.toUpperCase();

  try {
    const body = await request.json();

    // POST /api/rules - Create new rule
    if (method === "POST") {
      // Check for special actions
      if (body.action === "reorder") {
        // POST /api/rules/reorder
        const { ruleIds } = body as { ruleIds: string[] };
        if (!Array.isArray(ruleIds)) {
          return json(
            { success: false, error: "ruleIds must be an array" },
            { status: 400 }
          );
        }
        const updated = await reorderShopRules(admin, ruleIds);
        return json({
          success: true,
          data: { rules: updated.rules },
        });
      }

      if (body.action === "duplicate") {
        // POST /api/rules/duplicate
        const { ruleId } = body as { ruleId: string };
        const original = await getShopRule(admin, ruleId);
        if (!original) {
          return json(
            { success: false, error: `Rule not found: ${ruleId}` },
            { status: 404 }
          );
        }
        const duplicate = createEmptyRule(`${original.name} (Copy)`);
        duplicate.conditions = JSON.parse(JSON.stringify(original.conditions));
        duplicate.actions = JSON.parse(JSON.stringify(original.actions));
        duplicate.scope = original.scope;
        duplicate.scopeId = original.scopeId;
        duplicate.priority = original.priority + 1;
        duplicate.status = "draft";
        duplicate.tags = original.tags;

        const updated = await addShopRule(admin, duplicate);
        return json({
          success: true,
          data: { rule: duplicate, allRules: updated.rules },
        });
      }

      if (body.action === "bulk_status") {
        // POST /api/rules/bulk_status
        const { ruleIds, status } = body as {
          ruleIds: string[];
          status: Rule["status"];
        };
        const current = await getShopRules(admin);
        for (const id of ruleIds) {
          const rule = current.rules.find((r) => r.id === id);
          if (rule) {
            rule.status = status;
            rule.updatedAt = new Date().toISOString();
          }
        }
        const updated = await saveShopRules(admin, current);
        return json({
          success: true,
          data: { rules: updated.rules },
        });
      }

      if (body.action === "batch-create" && Array.isArray(body.rules)) {
        const created: Rule[] = [];
        for (const ruleData of body.rules) {
          const newRule = { ...createEmptyRule(ruleData.name || "New Rule"), ...ruleData };
          const validation = validateRule(newRule);
          if (!validation.valid) continue;
          await addShopRule(admin, newRule as Rule);
          created.push(newRule as Rule);
        }
        return json({ success: true, data: { rules: created } });
      }

      if (body.action === "bulk_delete") {
        // POST /api/rules/bulk_delete
        const { ruleIds } = body as { ruleIds: string[] };
        const current = await getShopRules(admin);
        current.rules = current.rules.filter((r) => !ruleIds.includes(r.id));
        const updated = await saveShopRules(admin, current);
        return json({
          success: true,
          data: { rules: updated.rules, deletedCount: ruleIds.length },
        });
      }

      // Standard create rule
      const ruleData = body.rule as Partial<Rule>;
      const newRule = {
        ...createEmptyRule(ruleData.name || "New Rule"),
        ...ruleData,
      };

      // Validate rule
      const validation = validateRule(newRule);
      if (!validation.valid) {
        return json(
          { success: false, error: validation.errors.join("; ") },
          { status: 400 }
        );
      }

      const updated = await addShopRule(admin, newRule as Rule);
      return json({
        success: true,
        data: { rule: newRule, allRules: updated.rules },
      });
    }

    // PUT /api/rules - Update existing rule
    if (method === "PUT") {
      // Check for settings update
      if (body.action === "settings") {
        const { globalSettings, evaluationMode } = body as {
          globalSettings?: Partial<ShopRulesMetafield["globalSettings"]>;
          evaluationMode?: ShopRulesMetafield["evaluationMode"];
        };

        let updated: ShopRulesMetafield | null = null;

        if (globalSettings) {
          updated = await updateGlobalSettings(admin, globalSettings);
        }

        if (evaluationMode) {
          updated = await updateEvaluationMode(admin, evaluationMode);
        }

        return json({
          success: true,
          data: {
            globalSettings: updated?.globalSettings,
            evaluationMode: updated?.evaluationMode,
          },
        });
      }

      // Standard rule update
      const { ruleId, updates } = body as {
        ruleId: string;
        updates: Partial<Rule>;
      };

      if (!ruleId) {
        return json(
          { success: false, error: "ruleId is required" },
          { status: 400 }
        );
      }

      // Get existing rule and merge updates
      const existing = await getShopRule(admin, ruleId);
      if (!existing) {
        return json(
          { success: false, error: `Rule not found: ${ruleId}` },
          { status: 404 }
        );
      }

      const merged = { ...existing, ...updates };

      // Validate merged rule
      const validation = validateRule(merged);
      if (!validation.valid) {
        return json(
          { success: false, error: validation.errors.join("; ") },
          { status: 400 }
        );
      }

      const updated = await updateShopRule(admin, ruleId, updates);
      return json({
        success: true,
        data: {
          rule: updated.rules.find((r) => r.id === ruleId),
          allRules: updated.rules,
        },
      });
    }

    // DELETE /api/rules - Delete rule
    if (method === "DELETE") {
      const { ruleId } = body as { ruleId: string };

      if (!ruleId) {
        return json(
          { success: false, error: "ruleId is required" },
          { status: 400 }
        );
      }

      const updated = await deleteShopRule(admin, ruleId);
      return json({
        success: true,
        data: { deletedRuleId: ruleId, allRules: updated.rules },
      });
    }

    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    console.error("[Rules API] Action error:", error);
    return json(
      {
        success: false,
        error: "Failed to process rules request",
      },
      { status: 500 }
    );
  }
};
