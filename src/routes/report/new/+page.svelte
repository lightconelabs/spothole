<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import { goto, invalidateAll } from '$app/navigation';
  import CategoryPicker from '$lib/components/CategoryPicker.svelte';
  import LocationPicker from '$lib/components/LocationPicker.svelte';
  import { checkImage } from '$lib/nsfw';
  import { compressImage, createImageElement } from '$lib/image';
  import { onDestroy } from 'svelte';
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

  let { data } = $props();

  let photoFile: File | null = $state(null);
  let photoPreview: string = $state('');
  let photoUrl: string = $state('');
  let category: string = $state('');
  let latitude: number = $state(50.8503);
  let longitude: number = $state(4.3517);
  let address: string = $state('');
  let description: string = $state('');
  let submitting: boolean = $state(false);
  let nsfwError: string = $state('');
  let error: string = $state('');
  let success: boolean = $state(false);
  let progress: number = $state(0);
  let progressLabel: string = $state('');

  let fileInput: HTMLInputElement = $state(null!);

  function revokePreview() {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      photoPreview = '';
    }
  }

  onDestroy(() => {
    revokePreview();
  });

  async function handlePhoto(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    nsfwError = '';

    const img = await createImageElement(file);
    const result = await checkImage(img);

    if (!result.safe) {
      nsfwError = m.nsfw_blocked();
      input.value = '';
      return;
    }

    photoFile = file;
    revokePreview();
    photoPreview = URL.createObjectURL(file);
  }

  async function handleSubmit() {
    if (!photoFile || !category) return;

    submitting = true;
    error = '';
    progress = 0;
    progressLabel = m.report_progress_compressing();

    try {
      const { supabase } = data;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signInAnonymously();
      }

      progress = 10;
      progressLabel = m.report_progress_compressing();

      const compressed = await compressImage(photoFile);
      const fileName = `${Date.now()}-${crypto.randomUUID()}.jpg`;

      progress = 30;
      progressLabel = m.report_progress_uploading();

      // Use XMLHttpRequest for upload progress tracking
      const uploadUrl = `${PUBLIC_SUPABASE_URL}/storage/v1/object/report-photos/${fileName}`;
      const sessionData = await supabase.auth.getSession();
      const accessToken = sessionData.data.session?.access_token;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken || PUBLIC_SUPABASE_ANON_KEY}`);
        xhr.setRequestHeader('Content-Type', 'image/jpeg');
        xhr.setRequestHeader('x-upsert', 'false');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            // Map upload progress to 30-85% of overall progress
            progress = 30 + Math.round((e.loaded / e.total) * 55);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(compressed);
      });

      progress = 85;

      const { data: urlData } = supabase.storage
        .from('report-photos')
        .getPublicUrl(fileName);

      photoUrl = urlData.publicUrl;

      progress = 90;
      progressLabel = m.report_progress_saving();

      // Submit via form action for server-side validation
      const formData = new FormData();
      formData.set('category', category);
      formData.set('description', description.trim());
      formData.set('latitude', String(latitude));
      formData.set('longitude', String(longitude));
      formData.set('address', address);
      formData.set('photo_url', photoUrl);

      const response = await fetch('?/default', {
        method: 'POST',
        body: formData,
        headers: { 'x-sveltekit-action': 'true' }
      });

      const result = await response.json();

      // SvelteKit wraps action results; handle both formats
      const actionResult = result.type !== undefined ? result : result.data?.[0];

      if (actionResult?.type === 'failure') {
        throw new Error(actionResult.data?.error || 'Failed to create report');
      }

      progress = 100;
      success = true;
    } catch (e) {
      error = m.common_error();
      console.error(e);
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>{m.report_new()} | {m.app_name()}</title>
</svelte:head>

<div class="page">
  {#if success}
    <div class="success-card">
      <div class="check">&#10003;</div>
      <h2>{m.report_success()}</h2>
      <p>{m.report_success_message()}</p>
      <button class="btn" onclick={() => { invalidateAll().then(() => goto('/')); }}>{m.report_view_on_map()}</button>
      {#if !data.session}
        <a href="/profile" class="btn btn-secondary">{m.report_sign_up_prompt()}</a>
      {/if}
    </div>
  {:else}
    <div class="form-header">
      <a href="/" class="back">&larr; {m.common_back()}</a>
      <h1>{m.report_new()}</h1>
    </div>

    <div class="form">
      <section>
        <label class="section-label" for="photo-input">{m.report_photo()}</label>
        {#if photoPreview}
          <div class="photo-preview">
            <img src={photoPreview} alt="Preview" />
            <button class="change-btn" onclick={() => fileInput.click()}>{m.report_photo_change()}</button>
          </div>
        {:else}
          <button class="photo-btn" onclick={() => fileInput.click()}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="12" cy="12" r="3" />
              <path d="M9 5l1-2h4l1 2" />
            </svg>
            <span>{m.report_photo()}</span>
          </button>
        {/if}
        <input
          id="photo-input"
          bind:this={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          onchange={handlePhoto}
          hidden
        />
        {#if nsfwError}
          <p class="error-text">{nsfwError}</p>
        {/if}
      </section>

      <section>
        <label class="section-label" for="category-picker">{m.report_category()}</label>
        <CategoryPicker bind:value={category} />
      </section>

      <section>
        <label class="section-label" for="location-picker">{m.report_location()}</label>
        <LocationPicker bind:latitude bind:longitude bind:address />
      </section>

      <section>
        <label class="section-label" for="description">{m.report_description()}</label>
        <textarea
          id="description"
          bind:value={description}
          placeholder={m.report_description_placeholder()}
          maxlength="500"
          rows="3"
        ></textarea>
      </section>

      {#if error}
        <p class="error-text">{error}</p>
      {/if}

      {#if submitting}
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" style="width: {progress}%"></div>
          </div>
          <p class="progress-label">{progressLabel}</p>
        </div>
      {/if}

      <button
        class="submit-btn"
        onclick={handleSubmit}
        disabled={!photoFile || !category || submitting}
      >
        {submitting ? m.report_submitting() : m.report_submit()}
      </button>
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 16px 16px 32px;
    max-width: 600px;
    margin: 0 auto;
  }

  .form-header {
    margin-bottom: 20px;
  }

  .back {
    font-size: 0.85rem;
    color: var(--color-gray-500);
  }

  h1 {
    font-size: 1.4rem;
    margin-top: 8px;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .photo-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px;
    border: 2px dashed var(--color-gray-300);
    border-radius: var(--radius-md);
    background: white;
    color: var(--color-gray-500);
    font-size: 0.9rem;
  }

  .photo-preview {
    position: relative;
  }

  .photo-preview img {
    width: 100%;
    max-height: 250px;
    object-fit: cover;
    border-radius: var(--radius-md);
  }

  .change-btn {
    position: absolute;
    bottom: 8px;
    right: 8px;
    padding: 6px 12px;
    background: rgba(0,0,0,0.6);
    color: white;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
  }

  textarea {
    padding: 12px;
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 0.9rem;
    resize: vertical;
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .submit-btn {
    padding: 14px;
    background: var(--color-primary);
    color: white;
    font-size: 1rem;
    font-weight: 600;
    border-radius: var(--radius-md);
    transition: background 0.15s;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .progress-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: var(--color-gray-200);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-primary);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .progress-label {
    font-size: 0.8rem;
    color: var(--color-gray-500);
    text-align: center;
  }

  .error-text {
    color: var(--color-danger);
    font-size: 0.85rem;
  }

  .success-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    padding: 48px 16px;
  }

  .check {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--color-success);
    color: white;
    font-size: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn {
    display: block;
    width: 100%;
    max-width: 300px;
    padding: 12px;
    border-radius: var(--radius-md);
    font-weight: 600;
    text-align: center;
    background: var(--color-primary);
    color: white;
  }

  .btn-secondary {
    background: var(--color-gray-100);
    color: var(--color-gray-700);
  }
</style>
