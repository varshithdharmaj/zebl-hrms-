import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { OfferLetterDocument } from "@/lib/recruitment/pdf/offer-letter-document";
import type { OfferLetterTemplateData } from "@/lib/recruitment/pdf/offer-letter-data";

/** Renders the offer letter template to a PDF buffer, server-side only. */
export async function renderOfferLetterPdf(data: OfferLetterTemplateData): Promise<Buffer> {
  // OfferLetterDocument's root render output is a <Document>, but its own
  // component type isn't literally DocumentProps — renderToBuffer only cares
  // about the rendered tree, so this cast is safe.
  const element = React.createElement(OfferLetterDocument, { data }) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
