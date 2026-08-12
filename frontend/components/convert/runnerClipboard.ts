import { downloadUrl } from '@/lib/api/endpoints';
import type { MergeResponse } from '@/lib/api/types';
import type { ConvertItemWithSession } from './ResultClipButton';
import { CLIPBOARD_MARKDOWN_SEPARATOR } from './runnerConstants';

export async function copyMergedOutput(
  sessionId: string,
  mergeResult: MergeResponse,
  copyText: (text: string) => Promise<boolean>,
): Promise<void> {
  const res = await fetch(downloadUrl(sessionId, mergeResult.output_file_id));
  const text = await res.text();
  await copyText(text);
}

export async function copyConvertedOutputs(
  convertedItems: ConvertItemWithSession[],
  fallbackSessionId: string | null,
  copyText: (text: string) => Promise<boolean>,
): Promise<void> {
  const texts = await Promise.all(
    convertedItems.map(async (item) => {
      const sid = item.session_id || fallbackSessionId;
      if (!item.output_file_id || !sid) return '';
      const res = await fetch(downloadUrl(sid, item.output_file_id));
      return res.text();
    }),
  );
  await copyText(texts.filter(Boolean).join(CLIPBOARD_MARKDOWN_SEPARATOR));
}
