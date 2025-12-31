/**
 * Sequences Service - Sequence template management
 */

import { supabaseAdmin } from "../lib/supabase.js";

/**
 * Create a new sequence with optional steps
 */
export async function createSequence(userId, { name, tone, stopRules, steps = [] }) {
    const { data: sequence, error } = await supabaseAdmin
        .from("sequences")
        .insert({
            user_id: userId,
            name,
            tone: tone || "professional",
            stop_rules: stopRules || { stop_on: ["replied", "booked"] }
        })
        .select()
        .single();

    if (error) throw error;

    // Add steps if provided
    if (steps.length > 0) {
        const stepsToInsert = steps.map((s, i) => ({
            sequence_id: sequence.id,
            step_order: i + 1,
            channel: s.channel,
            delay_days: s.delayDays || 0,
            template_a: s.templateA,
            template_b: s.templateB || null,
            subject_a: s.subjectA || null,
            subject_b: s.subjectB || null
        }));

        await supabaseAdmin.from("sequence_steps").insert(stepsToInsert);
    }

    return getSequence(sequence.id, userId);
}

/**
 * Get sequences for a user
 */
export async function getSequences(userId) {
    const { data, error } = await supabaseAdmin
        .from("sequences")
        .select(`*, sequence_steps(count)`)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data.map(s => ({
        id: s.id,
        name: s.name,
        tone: s.tone,
        stopRules: s.stop_rules,
        stepsCount: s.sequence_steps?.[0]?.count || 0,
        createdAt: s.created_at
    }));
}

/**
 * Get a single sequence with steps
 */
export async function getSequence(sequenceId, userId) {
    const { data, error } = await supabaseAdmin
        .from("sequences")
        .select(`*, sequence_steps(*)`)
        .eq("id", sequenceId)
        .eq("user_id", userId)
        .single();

    if (error) throw error;
    if (!data) return null;

    // Sort steps
    const steps = (data.sequence_steps || [])
        .sort((a, b) => a.step_order - b.step_order)
        .map(s => ({
            id: s.id,
            order: s.step_order,
            channel: s.channel,
            delayDays: s.delay_days,
            templateA: s.template_a,
            templateB: s.template_b,
            subjectA: s.subject_a,
            subjectB: s.subject_b
        }));

    return {
        id: data.id,
        name: data.name,
        tone: data.tone,
        stopRules: data.stop_rules,
        steps,
        createdAt: data.created_at
    };
}

/**
 * Update sequence metadata
 */
export async function updateSequence(sequenceId, userId, { name, tone, stopRules }) {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (tone !== undefined) updates.tone = tone;
    if (stopRules !== undefined) updates.stop_rules = stopRules;

    const { data, error } = await supabaseAdmin
        .from("sequences")
        .update(updates)
        .eq("id", sequenceId)
        .eq("user_id", userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete sequence
 */
export async function deleteSequence(sequenceId, userId) {
    const { error } = await supabaseAdmin
        .from("sequences")
        .delete()
        .eq("id", sequenceId)
        .eq("user_id", userId);

    if (error) throw error;
}

/**
 * Add step to sequence
 */
export async function addStep(sequenceId, userId, { channel, delayDays, templateA, templateB, subjectA, subjectB }) {
    // Verify ownership
    const { data: seq } = await supabaseAdmin
        .from("sequences")
        .select("id")
        .eq("id", sequenceId)
        .eq("user_id", userId)
        .single();

    if (!seq) throw new Error("Sequence not found");

    // Get next step order
    const { data: existingSteps } = await supabaseAdmin
        .from("sequence_steps")
        .select("step_order")
        .eq("sequence_id", sequenceId)
        .order("step_order", { ascending: false })
        .limit(1);

    const nextOrder = (existingSteps?.[0]?.step_order || 0) + 1;

    const { data: step, error } = await supabaseAdmin
        .from("sequence_steps")
        .insert({
            sequence_id: sequenceId,
            step_order: nextOrder,
            channel,
            delay_days: delayDays || 0,
            template_a: templateA,
            template_b: templateB || null,
            subject_a: subjectA || null,
            subject_b: subjectB || null
        })
        .select()
        .single();

    if (error) throw error;
    return step;
}

/**
 * Update step
 */
export async function updateStep(sequenceId, stepId, userId, updates) {
    // Verify ownership
    const { data: seq } = await supabaseAdmin
        .from("sequences")
        .select("id")
        .eq("id", sequenceId)
        .eq("user_id", userId)
        .single();

    if (!seq) throw new Error("Sequence not found");

    const dbUpdates = {};
    if (updates.channel !== undefined) dbUpdates.channel = updates.channel;
    if (updates.delayDays !== undefined) dbUpdates.delay_days = updates.delayDays;
    if (updates.templateA !== undefined) dbUpdates.template_a = updates.templateA;
    if (updates.templateB !== undefined) dbUpdates.template_b = updates.templateB;
    if (updates.subjectA !== undefined) dbUpdates.subject_a = updates.subjectA;
    if (updates.subjectB !== undefined) dbUpdates.subject_b = updates.subjectB;

    const { data, error } = await supabaseAdmin
        .from("sequence_steps")
        .update(dbUpdates)
        .eq("id", stepId)
        .eq("sequence_id", sequenceId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Delete step and reorder remaining
 */
export async function deleteStep(sequenceId, stepId, userId) {
    // Verify ownership
    const { data: seq } = await supabaseAdmin
        .from("sequences")
        .select("id")
        .eq("id", sequenceId)
        .eq("user_id", userId)
        .single();

    if (!seq) throw new Error("Sequence not found");

    // Get step order before deleting
    const { data: step } = await supabaseAdmin
        .from("sequence_steps")
        .select("step_order")
        .eq("id", stepId)
        .single();

    if (!step) throw new Error("Step not found");

    // Delete step
    await supabaseAdmin
        .from("sequence_steps")
        .delete()
        .eq("id", stepId);

    // Reorder subsequent steps
    const { data: remainingSteps } = await supabaseAdmin
        .from("sequence_steps")
        .select("id, step_order")
        .eq("sequence_id", sequenceId)
        .gt("step_order", step.step_order)
        .order("step_order");

    for (const s of remainingSteps || []) {
        await supabaseAdmin
            .from("sequence_steps")
            .update({ step_order: s.step_order - 1 })
            .eq("id", s.id);
    }
}
