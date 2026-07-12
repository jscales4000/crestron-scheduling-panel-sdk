<script lang="ts">
  import { onMount } from 'svelte';
  import { ROOM_NAME } from './lib/contract';
  import {
    roomState,
    clock,
    lastError,
    reserveNow,
    endCurrent,
    extendCurrent,
    checkIn
  } from './lib/stores/schedule';
  import type { Meeting } from './lib/data/types';

  const BASE_WIDTH = 1280;
  const BASE_HEIGHT = 800;
  const DEVICE_PROFILES = {
    auto: null,
    tsw770: { width: 1280, height: 800, label: 'TSS-770' },
    tsw1070: { width: 1920, height: 1200, label: 'TSS-1070' }
  } as const;

  let previewMode: keyof typeof DEVICE_PROFILES = 'auto';
  let viewportLabel = `${BASE_WIDTH}x${BASE_HEIGHT}`;
  let scaleLabel = '1.00x';
  let profileLabel = 'Auto';
  let showPreviewDock = false;
  let applyViewport = () => {};

  function setPreviewMode(mode: keyof typeof DEVICE_PROFILES) {
    previewMode = mode;
    applyViewport();
  }

  const timeFmt = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' });
  const fmtTime = (ms: number) => timeFmt.format(new Date(ms));
  const fmtRange = (m: Meeting) => `${fmtTime(m.start)} – ${fmtTime(m.end)}`;
  const title = (m: Meeting) => (m.isPrivate ? 'Reserved' : m.title);

  function minutesLeft(m: Meeting, now: number): number {
    return Math.max(0, Math.ceil((m.end - now) / 60_000));
  }
  function minutesUntil(m: Meeting, now: number): number {
    return Math.max(0, Math.ceil((m.start - now) / 60_000));
  }

  $: state = $roomState;
  $: now = $clock;
  $: statusLabel =
    state.status === 'available'
      ? 'Available'
      : state.status === 'checkin-pending'
        ? 'Check In Required'
        : 'In Use';

  onMount(() => {
    showPreviewDock = ['127.0.0.1', 'localhost'].includes(window.location.hostname);

    applyViewport = () => {
      const profile = DEVICE_PROFILES[previewMode];
      const viewportWidth = profile?.width ?? window.innerWidth;
      const viewportHeight = profile?.height ?? window.innerHeight;
      const scale = Math.min(viewportWidth / BASE_WIDTH, viewportHeight / BASE_HEIGHT);

      document.documentElement.style.setProperty('--panel-scale', scale.toString());
      document.documentElement.style.setProperty('--viewport-width', `${viewportWidth}px`);
      document.documentElement.style.setProperty('--viewport-height', `${viewportHeight}px`);

      viewportLabel = `${viewportWidth}x${viewportHeight}`;
      scaleLabel = `${scale.toFixed(2)}x`;
      profileLabel = profile?.label ?? 'Auto';
    };

    applyViewport();
    window.addEventListener('resize', applyViewport);

    return () => {
      window.removeEventListener('resize', applyViewport);
    };
  });
</script>

<svelte:head>
  <title>{ROOM_NAME} Scheduling</title>
</svelte:head>

<div class="panel-stage" data-status={state.status}>
  <div class="app-shell">
    <header class="app-header glass-card">
      <div class="header-copy">
        <p class="eyebrow">Room</p>
        <h1>{ROOM_NAME}</h1>
      </div>
      <div class="header-clock">
        <span class="clock-time">{fmtTime(now)}</span>
      </div>
    </header>

    <main class="schedule-stage">
      <section class="status-card glass-card" data-status={state.status}>
        <p class="status-label">{statusLabel}</p>

        {#if state.current}
          <h2 class="meeting-title">{title(state.current)}</h2>
          {#if !state.current.isPrivate}
            <p class="meeting-meta">{state.current.organizer}</p>
          {/if}
          <p class="meeting-meta">{fmtRange(state.current)} · {minutesLeft(state.current, now)} min left</p>

          <div class="action-row">
            {#if state.status === 'checkin-pending'}
              <button class="btn action primary" onclick={checkIn}>Check In</button>
            {/if}
            <button class="btn action" onclick={() => extendCurrent(15)}>Extend 15</button>
            <button class="btn action danger" onclick={endCurrent}>End Meeting</button>
          </div>
        {:else}
          {#if state.next}
            <p class="meeting-meta">Free for {minutesUntil(state.next, now)} min — next: {title(state.next)} at {fmtTime(state.next.start)}</p>
          {:else}
            <p class="meeting-meta">Free for the rest of the day</p>
          {/if}

          <div class="action-row">
            <button class="btn action primary" onclick={() => reserveNow(15)}>Reserve 15</button>
            <button class="btn action primary" onclick={() => reserveNow(30)}>Reserve 30</button>
            <button class="btn action primary" onclick={() => reserveNow(60)}>Reserve 60</button>
          </div>
        {/if}

        {#if $lastError}
          <p class="error-banner" role="alert">{$lastError}</p>
        {/if}
      </section>

      <aside class="agenda-card glass-card">
        <p class="display-label">Today</p>
        {#if state.today.length === 0}
          <p class="meeting-meta">No more meetings scheduled.</p>
        {:else}
          <ul class="agenda-list">
            {#each state.today as meeting (meeting.id)}
              <li class="agenda-item" class:current={meeting.id === state.current?.id}>
                <span class="agenda-time">{fmtRange(meeting)}</span>
                <span class="agenda-title">{title(meeting)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </aside>
    </main>

    <footer class="app-footer glass-card">
      <span class="footer-label">Mock schedule data — Google Calendar provider pending.</span>
    </footer>
  </div>

  {#if showPreviewDock}
    <aside class="preview-dock glass-card" aria-label="Local resolution preview controls">
      <div class="preview-copy">
        <strong>{profileLabel}</strong>
        <span>{viewportLabel} · {scaleLabel}</span>
      </div>
      <div class="preview-actions">
        <button class="preview-button btn" class:active={previewMode === 'auto'} onclick={() => setPreviewMode('auto')}>Auto</button>
        <button class="preview-button btn" class:active={previewMode === 'tsw770'} onclick={() => setPreviewMode('tsw770')}>770</button>
        <button class="preview-button btn" class:active={previewMode === 'tsw1070'} onclick={() => setPreviewMode('tsw1070')}>1070</button>
      </div>
    </aside>
  {/if}
</div>

<style>
  .schedule-stage {
    flex: 1;
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1rem;
    min-height: 0;
  }

  .status-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    border-left: 0.5rem solid #2ecc71;
  }
  .status-card[data-status='reserved'] {
    border-left-color: #e74c3c;
  }
  .status-card[data-status='checkin-pending'] {
    border-left-color: #f39c12;
  }

  .status-label {
    font-size: 1.1rem;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    opacity: 0.8;
    margin: 0;
  }

  .meeting-title {
    font-size: 2.2rem;
    margin: 0;
  }

  .meeting-meta {
    font-size: 1.1rem;
    opacity: 0.85;
    margin: 0;
  }

  .action-row {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .action {
    font-size: 1.1rem;
    padding: 0.9rem 1.4rem;
  }
  .action.primary {
    background: rgba(46, 204, 113, 0.25);
  }
  .action.danger {
    background: rgba(231, 76, 60, 0.25);
  }

  .error-banner {
    margin: 0.5rem 0 0;
    color: #ffb4a8;
  }

  .agenda-card {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .agenda-list {
    list-style: none;
    margin: 0.75rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .agenda-item {
    display: flex;
    flex-direction: column;
    padding: 0.6rem 0.8rem;
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.06);
  }
  .agenda-item.current {
    outline: 1px solid rgba(231, 76, 60, 0.6);
  }

  .agenda-time {
    font-size: 0.85rem;
    opacity: 0.7;
  }

  .agenda-title {
    font-size: 1.05rem;
  }

  .header-clock .clock-time {
    font-size: 1.6rem;
    font-variant-numeric: tabular-nums;
  }
</style>
