export interface RoutingStepInput {
  sequence_no: number;
  step_name: string;
  active_duration_minutes: number;
  wait_duration_minutes: number;
  work_center_id: number | null;
}

export interface RoutingInput {
  item_id: number;
  steps: RoutingStepInput[];
}

function parsePositiveInt(value: unknown, fieldLabel: string): { value?: number; error?: string } {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: `${fieldLabel} tidak valid.` };
  }
  return { value: parsed };
}

function parseNonNegativeInt(value: unknown, fieldLabel: string): { value?: number; error?: string } {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { error: `${fieldLabel} harus berupa bilangan bulat 0 atau lebih.` };
  }
  return { value: parsed };
}

export function parseRoutingInput(body: Record<string, unknown>): { input?: RoutingInput; error?: string } {
  const itemId = parsePositiveInt(body.item_id, 'Item');
  if (itemId.error) return { error: itemId.error };

  const rawSteps = Array.isArray(body.steps) ? body.steps : [];
  if (rawSteps.length === 0) {
    return { error: 'Routing harus punya minimal 1 tahap.' };
  }

  const steps: RoutingStepInput[] = [];
  const seenSequenceNos = new Set<number>();

  for (const rawStep of rawSteps) {
    const step = rawStep as Record<string, unknown>;

    const sequenceNo = parsePositiveInt(step.sequence_no, 'Urutan tahap');
    if (sequenceNo.error) return { error: sequenceNo.error };
    if (seenSequenceNos.has(sequenceNo.value!)) {
      return { error: `Urutan tahap ${sequenceNo.value} dipakai lebih dari sekali — tiap tahap harus punya urutan berbeda.` };
    }
    seenSequenceNos.add(sequenceNo.value!);

    const stepName = String(step.step_name ?? '').trim();
    if (!stepName) {
      return { error: 'Nama tahap wajib diisi.' };
    }

    const activeDuration = parseNonNegativeInt(step.active_duration_minutes, 'Durasi aktif');
    if (activeDuration.error) return { error: activeDuration.error };

    const waitDuration = parseNonNegativeInt(step.wait_duration_minutes ?? 0, 'Durasi tunggu');
    if (waitDuration.error) return { error: waitDuration.error };

    let workCenterId: number | null = null;
    if (step.work_center_id !== undefined && step.work_center_id !== null && step.work_center_id !== '') {
      const parsedWc = parsePositiveInt(step.work_center_id, 'Work Center');
      if (parsedWc.error) return { error: parsedWc.error };
      workCenterId = parsedWc.value!;
    }

    steps.push({
      sequence_no: sequenceNo.value!,
      step_name: stepName,
      active_duration_minutes: activeDuration.value!,
      wait_duration_minutes: waitDuration.value!,
      work_center_id: workCenterId
    });
  }

  return { input: { item_id: itemId.value!, steps } };
}
