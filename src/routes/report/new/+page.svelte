<script lang="ts">
  import { goto } from '$app/navigation';
  import * as m from '$lib/paraglide/messages.js';
  import CategoryPicker from '$lib/components/CategoryPicker.svelte';
  import LocationPicker from '$lib/components/LocationPicker.svelte';
  import { checkImage } from '$lib/nsfw';
  import { compressImage, createImageElement } from '$lib/image';

  let { data } = $props();

  let photoFile: File | null = $state(null);
  let photoPreview: string = $state('');
  let category: string = $state('');
  let latitude: number = $state(50.8503);
  let longitude: number = $state(4.3517);
  let address: string = $state('');
  let description: string = $state('');
  let submitting: boolean = $state(false);
  let nsfwError: string = $state('');
  let error: string = $state('');
  let success: boolean = $state(false);

  let fileInput: HTMLInputElement;

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
    photoPreview = URL.createObjectURL(file);
  }

  async function handleSubmit() {
    if (!photoFile || !category) return;

    submitting = true;
    error = '';

    try {
      const { supabase } = data;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signInAnonymously();
      }

      const compressed = await compressImage(photoFile);
      const fileName = `${Date.now()}-${crypto.randomUUID()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('report-photos')
        .upload(fileName, compressed, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('report-photos')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase.from('reports').insert({
        category,
        description: description.trim() || null,
        latitude,
        longitude,
        photo_url: urlData.publicUrl,
        user_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (insertError) throw insertError;

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
      <a href="/" class="btn">{m.report_view_on_map()}</a>
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
        <label class="section-label">{m.report_photo()}</label>
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
        <label class="section-label">{m.report_category()}</label>
        <CategoryPicker bind:value={category} />
      </section>

      <section>
        <label class="section-label">{m.report_location()}</label>
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
    padding: 16px;
    max-width: 600px;
    margin: 0 auto;
    height: 100%;
    overflow-y: auto;
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
