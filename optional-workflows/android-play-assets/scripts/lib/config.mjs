export function validateProjectConfig(config) {
  const project = config?.project;
  for (const key of ['id', 'name', 'androidPackage']) {
    if (!project?.[key]?.trim?.()) throw new Error(`project.${key} is required`);
  }
  for (const key of ['captures', 'takes']) {
    if (!config?.paths?.[key]?.trim?.()) throw new Error(`paths.${key} is required`);
  }
  if (!config?.device?.serial?.trim?.()) throw new Error('device.serial is required');
  if (!Array.isArray(config.locales) || config.locales.length === 0) throw new Error('at least one locale is required');
  const ids = new Set();
  for (const locale of config.locales) {
    if (!locale?.id?.trim?.()) throw new Error('locale.id is required');
    if (ids.has(locale.id)) throw new Error(`duplicate locale id: ${locale.id}`);
    if (!locale?.copy || typeof locale.copy !== 'object' || !Object.values(locale.copy).some((value) => typeof value === 'string' && value.trim())) {
      throw new Error(`locale.copy is required for ${locale.id}`);
    }
    ids.add(locale.id);
  }
  return config;
}

export function validateTimeline(timeline) {
  const scenes = timeline?.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) throw new Error('at least one scene is required');
  const crossfade = timeline.crossfadeMs ?? 0;
  if (!Number.isFinite(crossfade) || crossfade < 0) throw new Error('crossfadeMs must be non-negative');
  const ids = new Set();
  for (const scene of scenes) {
    if (!scene?.id?.trim?.()) throw new Error('scene.id is required');
    if (ids.has(scene.id)) throw new Error(`duplicate scene id: ${scene.id}`);
    if (!Number.isFinite(scene.durationMs) || scene.durationMs <= 0) throw new Error(`scene.durationMs must be positive for ${scene.id}`);
    ids.add(scene.id);
  }
  for (let i = 0; i < scenes.length - 1; i++) {
    if (crossfade >= scenes[i].durationMs || crossfade >= scenes[i + 1].durationMs) throw new Error('crossfadeMs must be shorter than adjacent scenes');
  }
  return timeline;
}
