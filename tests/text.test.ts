import { describe, expect, it } from "vitest";
import { htmlToText, signatureFromHtml, visibleReply, withoutSignature } from "../registry/support/text";

/** What Outlook on the web sends for a reply: body, signature div, then the quoted message. */
const outlookWebHtml = `<html><head><style>p{margin:0}</style></head><body dir="ltr">
<div class="elementToProof" style="font-family: Aptos, sans-serif;">Got it, thanks! This answer should land back in the same ticket.</div>
<div class="elementToProof"><br></div>
<div id="Signature" class="elementToProof"><div><p>Abderrahmane</p><p>Founder, <b>Software Savants</b></p></div></div>
<div id="appendonsend"></div>
<hr style="display:inline-block;width:98%" tabindex="-1">
<div id="divRplyFwdMsg" dir="ltr"><b>From:</b> Moorsyl Support &lt;support@moorsyl.com&gt;<br><b>Sent:</b> Sunday, November 8, 2026 4:33 PM<br><b>To:</b> Abderrahmane Abderrahmane<br><b>Subject:</b> Re: Test</div>
<div>Confirmed, the Moorsyl support inbox works.</div></body></html>`;

/** The plain-text part Outlook sends alongside it. */
const outlookWebText = `Got it, thanks! This answer should land back in the same ticket.

Abderrahmane

Founder, Software Savants

________________________________
From: Moorsyl Support <support@moorsyl.com>
Sent: Sunday, November 8, 2026 4:33 PM
To: Abderrahmane Abderrahmane
Subject: Re: Test

Confirmed, the Moorsyl support inbox works.`;

describe("visibleReply", () => {
  it("drops the separator line Outlook puts above the quoted header", () => {
    expect(visibleReply(outlookWebText)).toBe("Got it, thanks! This answer should land back in the same ticket.\n\nAbderrahmane\n\nFounder, Software Savants");
  });

  it("keeps separator lines that are part of what the person wrote", () => {
    expect(visibleReply("Totals\n-----\n12 MRU")).toBe("Totals\n-----\n12 MRU");
  });
});

describe("signatures", () => {
  it("finds the Outlook signature and removes it from the reply", () => {
    const signature = signatureFromHtml(outlookWebHtml);
    expect(signature).toBe("Abderrahmane\nFounder, Software Savants");
    expect(withoutSignature(visibleReply(outlookWebText), signature)).toBe(
      "Got it, thanks! This answer should land back in the same ticket."
    );
  });

  it("finds Gmail and Outlook mobile signatures", () => {
    expect(
      signatureFromHtml(
        `<div dir="ltr">Merci</div><br><span class="gmail_signature_prefix">-- </span><br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature"><div>Mariem Sidi</div><div>Boutique Nour</div></div>`
      )
    ).toBe("Mariem Sidi\nBoutique Nour");
    expect(signatureFromHtml(`<div>شكرا</div><div id="ms-outlook-mobile-signature"><div>Get Outlook for iOS</div></div>`)).toBe(
      "Get Outlook for iOS"
    );
  });

  it("only removes the signature from the end, ignoring spacing differences", () => {
    expect(withoutSignature("Call me back\n\n  Mariem   Sidi\n\nBoutique Nour  ", "Mariem Sidi\nBoutique Nour")).toBe("Call me back");
    expect(withoutSignature("Mariem Sidi here. Boutique Nour needs help.", "Mariem Sidi\nBoutique Nour")).toBe(
      "Mariem Sidi here. Boutique Nour needs help."
    );
  });

  it("keeps the message when it is nothing but the signature", () => {
    expect(withoutSignature("Mariem Sidi\nBoutique Nour", "Mariem Sidi\nBoutique Nour")).toBe("Mariem Sidi\nBoutique Nour");
  });

  it("ignores a signature nested inside the quoted message", () => {
    expect(signatureFromHtml(`<div>New text</div><blockquote><div id="Signature">Old signature</div></blockquote>`)).toBeNull();
  });

  it("returns null without a marked signature", () => {
    expect(signatureFromHtml("<p>Hello</p>")).toBeNull();
    expect(signatureFromHtml(null)).toBeNull();
  });
});

describe("htmlToText", () => {
  it("keeps the signature text so the trimmed reply can be compared against it", () => {
    expect(htmlToText(outlookWebHtml)).toContain("Founder, Software Savants");
  });
});
