import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { bookHtml, type BookDocument } from './bookHtml';
export async function exportBook(book: BookDocument): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: bookHtml(book) });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: book.title });
  else await Print.printAsync({ uri });
}
