# Slacktor v0.1.1

Slacktor is a Chromium extension that translates Slack Web messages directly in
the conversation using an OpenAI-compatible AI provider configured by the user.

This is an early testing release. Please try it with a non-critical Slack
workspace first and report unexpected behavior through GitHub Issues.

## Highlights

- Translate Slack messages manually or automatically below the original text.
- Use thread context to improve references and terminology.
- Prioritize messages in the open thread panel and newer Slack messages.
- Reserve translation capacity for newly posted messages so they do not wait
  behind the full visible channel history.
- Deduplicate Slack DOM copies so one canonical message uses one provider call.
- Cache translations locally for seven days across page and extension reloads.
- Use Quick Translator from the popup with local translation history.
- Configure any compatible HTTPS endpoint or a local provider on `localhost` or
  `127.0.0.1`.

## Improvements In v0.1.1

- Improved translation queue ordering for open threads and recent messages.
- Added reserved concurrency slots for responsive translation of new activity.
- Reduced duplicate provider calls caused by Slack optimistic rendering and DOM
  virtualization.
- Stabilized translation cache identity across Slack and extension reloads.
- Improved queued, stopped, retry, and per-message retranslation states.
- Split **Stop translations** and **Clear translation cache** into independent
  controls.
- Updated Stop behavior so queued jobs stop while active requests finish.
- Fixed Quick Translator draft clearing and history behavior.
- Updated **Test provider** to test the current form values instead of previously
  saved settings.
- Automatically saves provider settings after a successful provider test.
- Moved **Test provider** above **Save configuration**.

## Install For Testing

1. Download `Slacktor-0.1.1.zip` from the Assets section below.
2. Extract the ZIP to a permanent local directory.
3. Open `chrome://extensions` in Chrome or another Chromium-based browser.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the directory containing the extracted `manifest.json`.
7. Pin Slacktor from the browser extensions menu.
8. Open or refresh `https://app.slack.com/`.

Do not load the ZIP directly. Chrome requires the extracted directory for an
unpacked extension.

## Configure A Provider

1. Open Slacktor and accept the Slack data disclosure.
2. Open Settings.
3. Enter an OpenAI-compatible endpoint, model, API key, and target language.
4. Click **Test provider**.
5. Approve Chrome access to the configured provider origin when prompted.

The test uses the values currently displayed in the form. When it succeeds,
Slacktor saves those settings automatically. A failed test does not replace the
previously saved configuration.

Example:

```text
AI endpoint: https://api.openai.com/v1
Model: gpt-4o-mini
Translate to: Vietnamese
```

API usage and charges are applied by the provider configured by the tester.

## Suggested Test Checklist

- Test a valid and an invalid API key through **Test provider**.
- Translate one Slack message manually.
- Enable automatic translation and open a channel with existing messages.
- Post a new message and confirm it starts translating without waiting behind
  all older visible messages.
- Open a thread panel and confirm its messages receive priority.
- Confirm the same Slack message does not generate duplicate provider requests.
- Reload the Slack page and confirm cached translations are reused.
- Use the per-message reload button and confirm it requests a fresh translation.
- Click **Stop translations** and confirm queued jobs stop while active jobs
  finish.
- Click **Clear translation cache** and confirm it does not stop active requests
  or automatically retranslate messages.
- Try Quick Translator and reopen the popup to verify draft and history behavior.

## Privacy And Security

- Slacktor has no developer-operated AI backend.
- Slack content is sent only to the endpoint configured by the user.
- API keys are stored locally and are not exposed to Slack page scripts.
- Translation cache, thread context, Quick Translator history, and logs are
  stored locally in the browser.
- Diagnostic logs do not contain API keys or Slack message text.
- Slacktor does not use analytics, advertising, or remote executable code.

Privacy policy: https://ductrungdoit.github.io/Slacktor/privacy-policy.html

## Known Limitations

- Slacktor relies on Slack's public DOM. Future Slack UI changes may temporarily
  affect message detection, thread detection, or translation placement.
- This release is distributed as an unpacked extension for testing. Keep the
  extracted directory after installation.
- Using a different unpacked extension directory may create a different Chrome
  extension ID and therefore separate local settings and IndexedDB data.
- Translation quality, latency, rate limits, and cost depend on the selected AI
  provider and model.

## Feedback

Please report issues at:

https://github.com/ductrungdoit/Slacktor/issues

Useful details include:

- Browser name and version.
- Slack UI language.
- Provider type and model, without sharing the API key.
- Whether the issue occurred in a channel or thread panel.
- Reproduction steps and screenshots with sensitive Slack content hidden.
- Slacktor diagnostic logs when relevant; these logs exclude API keys and Slack
  message text.

## Vietnamese Test Invitation

Mình vừa đóng gói bản thử nghiệm Slacktor `v0.1.1`, một extension dịch tin nhắn
trực tiếp trên Slack Web bằng AI provider do người dùng tự cấu hình.

Anh em có thể tải file `Slacktor-0.1.1.zip` trong phần Assets của GitHub Release,
giải nén, mở `chrome://extensions`, bật Developer mode rồi chọn **Load unpacked**.

Nhờ anh em thử giúp các tình huống sau:

- Test cấu hình bằng API key đúng và sai.
- Dịch thủ công và auto-translate trong channel.
- Gửi tin nhắn mới khi đang có nhiều tin cũ chờ dịch.
- Mở thread và kiểm tra tin trong thread có được ưu tiên không.
- Reload Slack để kiểm tra cache.
- Thử Stop translations, Clear translation cache và Quick Translator.

Nếu gặp lỗi, vui lòng tạo issue tại
https://github.com/ductrungdoit/Slacktor/issues và gửi browser/version, bước tái
hiện, provider/model đang dùng nhưng không gửi API key hoặc nội dung Slack nhạy
cảm. Cảm ơn anh em!
