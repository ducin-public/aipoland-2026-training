# Plan migracji adapterów LLM w Azor (dla agenta)

**Zakres:** `azor/src/llm/*` (+ powiązane zależności i konfiguracja `.env.example`).  
**Poza zakresem:** `llamaClient.ts`, `llamaValidation.ts` — nie modyfikować.

**Cel:** Odtworzyć w TypeScriptie poprawki sprawdzone w trzech małych projektach szkoleniowych (`external-model-openai-node`, `external-model-anthropic-node`, `external-model-google-genai-node`), tak aby Azor nie zwracał pustych odpowiedzi z modeli „reasoning / thinking” i używał aktualnych SDK oraz domyślnych ID modeli.

**Źródła prawdy (działające skrypty):**

| Provider | Folder | Kluczowy plik |
|----------|--------|----------------|
| OpenAI | `external-model-openai-node/` | `run.js` |
| Anthropic | `external-model-anthropic-node/` | `run.js` |
| Google | `external-model-google-genai-node/` | `run.js` |

---

## Stan obecny w Azor (do poprawy)

| Plik | Problem |
|------|---------|
| `openaiClient.ts` | Brak `reasoning_effort` dla modeli GPT-6 / reasoning; tekst tylko z `message.content` (OK przy `reasoning_effort: "none"`). Domyślny model w walidacji: `gpt-4-turbo`. SDK `openai` ^4.x. |
| `anthropicClient.ts` | Ekstrakcja tekstu z bloków `type: "text"` jest **już poprawna**. Gdy `thinkingBudget` **nie** jest podany, API domyślnie włącza thinking → możliwy pusty tekst przy niskim `max_tokens`. SDK ^0.32.x. |
| `geminiClient.ts` | Stary pakiet `@google/generative-ai` (`GoogleGenerativeAI`, `startChat`, `generationConfig.thinkingBudget`). Nie obsługuje Gemini 3.x (`thinkingLevel` vs `thinkingBudget`). Domyślny model: `gemini-2.5-flash`. |
| `package.json` | Przestarzałe wersje SDK względem projektów szkoleniowych. |
| `.env.example` | Przestarzałe domyślne nazwy modeli. |

Interfejs `ILLMClient.createChatSession(..., thinkingBudget?: number)` — **zachować sygnaturę** (używany przez `chatSession.ts`; opcjonalny trzeci argument nie jest tam przekazywany). Logika: gdy brak `thinkingBudget`, zachowanie bezpieczne jak w skryptach demo (wyłączone / minimalne reasoning).

---

## Podsumowanie zmian w projektach szkoleniowych

### OpenAI (`external-model-openai-node`)

1. **Model:** np. `gpt-6-luna` (lista w komentarzach: gpt-6-astra, 6.1-sol/terra, 6-sol, 6-luna, 5.6-*, chat-latest).
2. **SDK:** `openai` **^7.57.0**.
3. **API:** `chat.completions.create` z `max_completion_tokens` (nie `max_tokens`).
4. **Reasoning:** `reasoning_effort: "none"` dla prostego chatu (wartości: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`).
5. **Odczyt odpowiedzi:** `message.content` jako string; pusty content przy domyślnym reasoning + zbyt niski limit tokenów.
6. **Opcjonalnie w logach:** `usage.completion_tokens_details.reasoning_tokens` (Azor może pominąć, jeśli `LLMResponse` nie ma usage).

### Anthropic (`external-model-anthropic-node`)

1. **Model:** np. `claude-haiku-5-5` (komentarze: opus/sonnet/haiku 5-5, fable/mythos 5-2).
2. **SDK:** `@anthropic-ai/sdk` **^1.8.0** (import `@anthropic-ai/sdk`, bez `@anthropic-ai/tokenizer`).
3. **API:** `messages.create` z `system` przekazywanym osobno (w Azor już tak).
4. **Thinking:** domyślnie `thinking: { type: 'disabled' }` dla demo chatu (`disabled` | `enabled` + `budget_tokens`).
5. **Odczyt odpowiedzi:** **tylko** bloki `content[]` z `type === "text"` — **nie** `content[0].text`.
6. **`max_tokens`:** sensowny limit (np. 512+ w demo, Azor ma 4096 — OK).

### Google GenAI (`external-model-google-genai-node`)

1. **Model domyślny (budżet / free tier):** `gemini-3.5-flash-lite` (lista w komentarzach od 3.8-flash w dół, aliasy `gemini-flash-lite-latest`, `gemini-flash-latest`, legacy 2.5 / 1.5).
2. **SDK:** **`@google/genai`** (nie `@google/generative-ai`), `GoogleGenAI`, `ai.models.generateContent`.
3. **Dwa warianty konfiguracji** (bez helpera `buildConfig` — dwa jawne bloki w demo; w Azor można jeden `if` w `sendMessage` / `createChatSession`):
   - **Legacy** (`model.startsWith("gemini-2.5")` lub `gemini-1.5`): `thinkingConfig: { thinkingBudget: 0 }` (+ `systemInstruction`).
   - **Gemini 3.x / aliasy:** `systemInstruction`; dla Flash-Lite często bez thinking lub z `thinkingLevel: "minimal"` (wartości: `minimal`, `low`, `medium`, `high` — **nie** mieszać z `thinkingBudget` w jednym requeście → 400).
4. **Format historii:** `contents` z `role: "user" | "model"`, `parts: [{ text }]`.
5. **Odpowiedź:** `response.text` (SDK agreguje części tekstowe).

---

## Zadania dla agenta (kolejność)

### 0. Przygotowanie

- [ ] Przeczytać: `azor/src/llm/openaiClient.ts`, `anthropicClient.ts`, `geminiClient.ts`, `*Validation.ts`, `azor/src/types/index.ts`, `azor/src/session/chatSession.ts`.
- [ ] Po zmianach: `cd azor && npm install && npm run build` (i ewentualnie ręczny smoke z `ENGINE=... npm run dev`).

### 1. `package.json` (azor)

Zaktualizuj zależności (wersje jak w projektach szkoleniowych lub nowsze patch):

```json
"openai": "^7.57.0",
"@anthropic-ai/sdk": "^1.8.0",
"@google/genai": "^1.27.0"
```

- [ ] Usuń `@google/generative-ai` jeśli żaden plik go już nie importuje (po migracji `geminiClient.ts`).
- [ ] Nie zmieniaj `node-llama-cpp` ani logiki Llama.

### 2. Walidacja i domyślne modele

| Plik | Pole | Stara domyślna | Nowa domyślna (sugerowana) |
|------|------|----------------|-----------------------------|
| `openaiValidation.ts` | `modelName` | `gpt-4-turbo` | `gpt-6-luna` (lub `gpt-6-astra` — wybierz jedną sensowną dla produkcji; zsynchronizuj z `.env.example`) |
| `anthropicValidation.ts` | `modelName` | `claude-3-5-haiku-latest` | `claude-haiku-5-5` |
| `geminiValidation.ts` | `modelName` | `gemini-2.5-flash` | `gemini-3.5-flash-lite` |

- [ ] Zaktualizuj `azor/.env.example` tymi samymi wartościami i krótką notą o modelach legacy (opcjonalnie).

### 3. `openaiClient.ts`

- [ ] Dodać funkcję pomocniczą (lokalnie w pliku) do tekstu asystenta — jak w `run.js`: string z `message.content`, trim, fallback `""`.
- [ ] W `chat.completions.create`:
  - Zachować / ustawić `max_completion_tokens` (4096 jest OK).
  - Dla modeli reasoning (heurystyka: prefiks `gpt-5`, `gpt-6`, `o3`, `o4` lub lista znana z dokumentacji): ustaw **`reasoning_effort: "none"`** domyślnie, gdy `thinkingBudget` **nie** jest przekazany.
  - Opcjonalnie: jeśli kiedyś `thinkingBudget` zostanie użyte dla OpenAI, mapuj go na wyższy `reasoning_effort` zamiast ignorować parametr (minimalny zakres — nie wymagane w pierwszej iteracji).
- [ ] Zaktualizować komentarz przy `createChatSession` — OpenAI **obsługuje** reasoning przez `reasoning_effort`, nie przez `thinkingBudget` w stylu Gemini.
- [ ] Sprawdzić typy po upgrade SDK 7.x (ew. import typów `ChatCompletionMessageParam`).

**Test akceptacji:** `ENGINE=OPENAI`, jedna wiadomość — odpowiedź niepusta.

### 4. `anthropicClient.ts`

- [ ] Gdy `thinkingBudget === undefined`: ustaw **`thinking: { type: 'disabled' }`** (jak w `run.js`), żeby uniknąć pustego `content` przy domyślnym thinking API.
- [ ] Gdy `thinkingBudget` jest liczbą: **`thinking: { type: 'enabled', budget_tokens: thinkingBudget }`** (już jest — zostawić).
- [ ] Ekstrakcję tekstu z bloków `text` — zostawić (już zgodna ze szkoleniem).
- [ ] Upewnić się, że import SDK jest z `@anthropic-ai/sdk` (bez starego `index.js`).

**Test akceptacji:** `ENGINE=ANTHROPIC`, żart / krótka wymiana — tekst niepusty.

### 5. `geminiClient.ts` (największa zmiana)

Przepisać klienta na **`@google/genai`**:

- [ ] `constructor`: `new GoogleGenAI({ apiKey })` (API key z env; jak w demo może też działać env automatycznie — w Azor jawny klucz jest OK).
- [ ] Zamiast `startChat` + `sendMessage`: trzymać historię w wrapperze (`GeminiChatSessionWrapper`) i przy każdej wiadomości wołać **`ai.models.generateContent({ model, contents, config })`** z pełną historią (jak w demo).
- [ ] Konwersja `Message[]` → `contents` (`user` / `model`, `parts: [{ text }]`).
- [ ] **`systemInstruction`:** string lub obiekt zgodny z SDK — jak w `run.js` (prosty string w `config.systemInstruction`).
- [ ] **Rozgałęzienie legacy vs nowe API** (w `sendMessage` lub jednym miejscu przy budowaniu `config` — **bez** osobnej abstrakcji typu `buildConfig`, chyba że projekt już wymaga DRY; preferencja trenera: dwa czytelne bloki `if/else` z pełnym obiektem requestu):

  ```ts
  if (modelName.startsWith('gemini-2.5') || modelName.startsWith('gemini-1.5')) {
    // config: systemInstruction + thinkingConfig.thinkingBudget: 0
  } else {
    // config: systemInstruction; Flash-Lite bez thinkingConfig lub thinkingLevel: 'minimal' dla pozostałych 3.x
  }
  ```

- [ ] Mapowanie opcjonalnego `thinkingBudget` z interfejsu:
  - Legacy Gemini: `thinkingBudget` w `thinkingConfig` (0 = off).
  - Gemini 3.x: **nie** przekazywać `thinkingBudget`; opcjonalnie mapować na `thinkingLevel` tylko jeśli product tego wymaga (domyślnie jak demo: lite bez config, inne z `minimal`).
- [ ] Odpowiedź: `result.text` (obsłużyć undefined → `""`).
- [ ] Usuń zależność od `GoogleGenerativeAI` / `Content` ze starego pakietu.

**Test akceptacji:** `ENGINE=GEMINI`, domyślny model `gemini-3.5-flash-lite`, dialog Gandalf-style lub dowolna wiadomość — `response.text` niepusty.

### 6. Czego nie robić

- Nie zmieniać `ILLMClient` / `ILLMChatSession` bez potrzeby (tylko jeśli typy SDK wymuszą drobne poprawki).
- Nie refaktoryzować `chatSession.ts` poza ewentualnym przekazaniem `thinkingBudget` w przyszłości.
- Nie dodawać nowych plików konfiguracyjnych poza aktualizacją `.env.example`.
- Nie rozszerzać `LLMResponse` o usage, chyba że użytkownik poprosi.

---

## Checklista końcowa

- [ ] `npm run build` bez błędów TypeScript.
- [ ] Smoke: OPENAI, ANTHROPIC, GEMINI (trzy uruchomienia z odpowiednim `ENGINE` i kluczami w `.env`).
- [ ] Domyślne modele w walidacji zgodne z `.env.example`.
- [ ] Llama nadal działa bez zmian w kodzie.

---

## Szybkie odniesienie — „dlaczego było pusto”

| Provider | Przyczyna pustej odpowiedzi | Fix w szkoleniu |
|----------|----------------------------|-----------------|
| OpenAI | Cały limit na `reasoning_tokens`, `content` = `""` | `reasoning_effort: "none"`, wyższy `max_completion_tokens` |
| Anthropic | Pierwszy blok `thinking`, nie `text` | `thinking: disabled` + parsowanie bloków `text` |
| Gemini | `thinkingBudget: 0` na modelu 3.x → 400; zły SDK | Rozdzielenie legacy/3.x, `@google/genai`, Flash-Lite bez `thinkingBudget` |

---

*Dokument przygotowany na podstawie sesji aktualizacji projektów `external-model-*-node` (listopad 2026). Agent wykonujący plan powinien trzymać zmiany w minimalnym diffie i konwencjach istniejącego kodu Azor.*