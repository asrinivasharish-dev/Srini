import QRCode from 'qrcode';
import { DocumentSection } from '../types';

export interface ParsedQrData {
  raw: string;
  type: 'url' | 'vcard' | 'wifi' | 'json' | 'email' | 'tel' | 'sms' | 'markdown' | 'text';
  title: string;
  subtitle?: string;
  details?: Record<string, string>;
  suggestedSections: DocumentSection[];
  qrImageDataUrl?: string;
}

/**
 * Generate a clean PNG data URL for any QR text using the qrcode library
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#1e1b4b',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR data URL:', err);
    return '';
  }
}

/**
 * Parse any scanned QR code payload and produce intelligent, structured document sections
 */
export async function parseQrContent(rawText: string): Promise<ParsedQrData> {
  const text = rawText.trim();
  const qrImage = await generateQrDataUrl(text);

  // 1. Check for URL
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const domain = url.hostname.replace(/^www\./, '');
      const pathSegments = url.pathname.split('/').filter(Boolean);
      const slug = pathSegments.length > 0 ? decodeURIComponent(pathSegments[pathSegments.length - 1]) : domain;

      const title = `Web Reference: ${domain}`;
      const subtitle = `Scanned URL • ${new Date().toLocaleDateString()}`;

      const sections: DocumentSection[] = [
        {
          id: 'qr-head-1',
          type: 'heading',
          content: `Resource Link: ${slug || domain}`,
        },
        {
          id: 'qr-callout-1',
          type: 'callout',
          content: `🌐 Target Web Address:\n${text}`,
        },
        {
          id: 'qr-para-1',
          type: 'paragraph',
          content: `This document contains an imported reference to ${domain}. The resource was scanned via the mobile QR code importer on ${new Date().toLocaleString()}.`,
        },
        {
          id: 'qr-bullet-1',
          type: 'bullet',
          content: `Domain Host: ${url.hostname}`,
        },
        {
          id: 'qr-bullet-2',
          type: 'bullet',
          content: `Protocol: ${url.protocol.replace(':', '').toUpperCase()}`,
        },
        ...(url.search
          ? [
              {
                id: 'qr-bullet-3',
                type: 'bullet' as const,
                content: `Query Parameters: ${url.search}`,
              },
            ]
          : []),
      ];

      return {
        raw: text,
        type: 'url',
        title,
        subtitle,
        details: {
          Domain: domain,
          Protocol: url.protocol,
          Path: url.pathname || '/',
        },
        suggestedSections: sections,
        qrImageDataUrl: qrImage,
      };
    } catch {
      // fallback to plain text if URL parse fails
    }
  }

  // 2. Check for Wi-Fi String (WIFI:S:MySSID;T:WPA;P:MyPassword;;)
  if (/^WIFI:/i.test(text)) {
    const ssidMatch = text.match(/S:([^;]*)/i);
    const passMatch = text.match(/P:([^;]*)/i);
    const typeMatch = text.match(/T:([^;]*)/i);
    const hiddenMatch = text.match(/H:([^;]*)/i);

    const ssid = ssidMatch ? ssidMatch[1] : 'Unknown Network';
    const pass = passMatch ? passMatch[1] : '';
    const authType = typeMatch ? typeMatch[1] : 'WPA/WPA2';

    const sections: DocumentSection[] = [
      {
        id: 'qr-wf-head',
        type: 'heading',
        content: `Wi-Fi Network Access: ${ssid}`,
      },
      {
        id: 'qr-wf-callout',
        type: 'callout',
        content: `📶 Network SSID: ${ssid}\n🔑 Password: ${pass ? pass : '(Open / No Password)'}\n🔒 Security Type: ${authType}`,
      },
      {
        id: 'qr-wf-para',
        type: 'paragraph',
        content: 'Scan this document or the attached QR badge on any compatible mobile phone or tablet to automatically connect to this local wireless network.',
      },
      {
        id: 'qr-wf-bullet1',
        type: 'bullet',
        content: `Authentication Standard: ${authType}`,
      },
      {
        id: 'qr-wf-bullet2',
        type: 'bullet',
        content: `Hidden SSID: ${hiddenMatch && hiddenMatch[1] === 'true' ? 'Yes' : 'No'}`,
      },
    ];

    return {
      raw: text,
      type: 'wifi',
      title: `Wi-Fi Access Pass: ${ssid}`,
      subtitle: `Wireless Network Configuration Card`,
      details: {
        SSID: ssid,
        Security: authType,
        Password: pass ? '••••••••' : 'None',
      },
      suggestedSections: sections,
      qrImageDataUrl: qrImage,
    };
  }

  // 3. Check for vCard (BEGIN:VCARD ... END:VCARD)
  if (/BEGIN:VCARD/i.test(text)) {
    const fnMatch = text.match(/FN:([^\r\n]+)/i);
    const emailMatch = text.match(/EMAIL[^:]*:([^\r\n]+)/i);
    const telMatch = text.match(/TEL[^:]*:([^\r\n]+)/i);
    const orgMatch = text.match(/ORG:([^\r\n]+)/i);
    const titleMatch = text.match(/TITLE:([^\r\n]+)/i);

    const name = fnMatch ? fnMatch[1] : 'Contact Profile';
    const email = emailMatch ? emailMatch[1] : '';
    const tel = telMatch ? telMatch[1] : '';
    const org = orgMatch ? orgMatch[1] : '';
    const job = titleMatch ? titleMatch[1] : '';

    const sections: DocumentSection[] = [
      {
        id: 'qr-vc-head',
        type: 'heading',
        content: `Contact Card: ${name}`,
      },
      {
        id: 'qr-vc-callout',
        type: 'callout',
        content: `👤 Full Name: ${name}${job ? ` • ${job}` : ''}${org ? ` (${org})` : ''}\n📧 Email: ${email || 'N/A'}\n📞 Phone: ${tel || 'N/A'}`,
      },
      {
        id: 'qr-vc-para',
        type: 'paragraph',
        content: `This contact profile document was generated from a scanned digital business card (vCard) on ${new Date().toLocaleDateString()}.`,
      },
      ...(tel ? [{ id: 'qr-vc-b1', type: 'bullet' as const, content: `Primary Phone: ${tel}` }] : []),
      ...(email ? [{ id: 'qr-vc-b2', type: 'bullet' as const, content: `Email Address: ${email}` }] : []),
      ...(org ? [{ id: 'qr-vc-b3', type: 'bullet' as const, content: `Organization: ${org}` }] : []),
    ];

    return {
      raw: text,
      type: 'vcard',
      title: `Contact Profile: ${name}`,
      subtitle: job ? `${job} • ${org}` : 'Imported vCard Contact',
      details: {
        Name: name,
        Organization: org || 'N/A',
        Email: email || 'N/A',
        Phone: tel || 'N/A',
      },
      suggestedSections: sections,
      qrImageDataUrl: qrImage,
    };
  }

  // 4. Check for JSON format
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      const parsed = JSON.parse(text);
      const isArray = Array.isArray(parsed);
      const keys = !isArray && typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : [];

      const sections: DocumentSection[] = [
        {
          id: 'qr-json-head',
          type: 'heading',
          content: 'Structured Data Payload (JSON)',
        },
        {
          id: 'qr-json-callout',
          type: 'callout',
          content: `Data Type: ${isArray ? `Array (${parsed.length} items)` : `Object (${keys.length} fields)`}\nScanned on: ${new Date().toLocaleString()}`,
        },
        {
          id: 'qr-json-para',
          type: 'paragraph',
          content: JSON.stringify(parsed, null, 2),
        },
      ];

      return {
        raw: text,
        type: 'json',
        title: 'Structured JSON Payload',
        subtitle: `Imported Data Sheet • ${keys.length} properties`,
        suggestedSections: sections,
        qrImageDataUrl: qrImage,
      };
    } catch {
      // not valid json, fall through
    }
  }

  // 5. Check for Email / Tel / SMS URI
  if (/^mailto:/i.test(text)) {
    const email = text.replace(/^mailto:/i, '').split('?')[0];
    return {
      raw: text,
      type: 'email',
      title: `Email Contact: ${email}`,
      subtitle: 'Electronic Mail Dispatch Card',
      details: { Email: email },
      suggestedSections: [
        { id: 'qr-em-head', type: 'heading', content: `Email Dispatch: ${email}` },
        { id: 'qr-em-callout', type: 'callout', content: `Direct Email Address:\n${email}` },
        { id: 'qr-em-para', type: 'paragraph', content: `Scanned on ${new Date().toLocaleString()} for record archiving.` },
      ],
      qrImageDataUrl: qrImage,
    };
  }

  if (/^tel:/i.test(text)) {
    const phone = text.replace(/^tel:/i, '');
    return {
      raw: text,
      type: 'tel',
      title: `Phone Record: ${phone}`,
      subtitle: 'Telephone Speed Dial Card',
      details: { Phone: phone },
      suggestedSections: [
        { id: 'qr-tel-head', type: 'heading', content: `Telephone Contact: ${phone}` },
        { id: 'qr-tel-callout', type: 'callout', content: `📞 Phone Number: ${phone}` },
        { id: 'qr-tel-para', type: 'paragraph', content: `Scanned on ${new Date().toLocaleString()}.` },
      ],
      qrImageDataUrl: qrImage,
    };
  }

  // 6. Multi-line Markdown / Text Document
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length > 1) {
    const firstLine = lines[0].replace(/^[#\-\*\s]+/, '').trim();
    const title = firstLine.length < 50 ? firstLine : 'Imported Scanned Document';

    const sections: DocumentSection[] = [];
    sections.push({
      id: 'qr-text-head',
      type: 'heading',
      content: title,
    });

    // Parse remaining lines
    let currentParagraphs: string[] = [];

    for (let i = (firstLine === title ? 1 : 0); i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#')) {
        if (currentParagraphs.length > 0) {
          sections.push({
            id: `qr-p-${i}`,
            type: 'paragraph',
            content: currentParagraphs.join('\n'),
          });
          currentParagraphs = [];
        }
        sections.push({
          id: `qr-h-${i}`,
          type: 'heading',
          content: line.replace(/^#+\s*/, ''),
        });
      } else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
        if (currentParagraphs.length > 0) {
          sections.push({
            id: `qr-p-${i}`,
            type: 'paragraph',
            content: currentParagraphs.join('\n'),
          });
          currentParagraphs = [];
        }
        sections.push({
          id: `qr-b-${i}`,
          type: 'bullet',
          content: line.replace(/^([-\*]|\d+\.)\s*/, ''),
        });
      } else if (line.startsWith('>') || line.startsWith('NOTE:') || line.startsWith('IMPORTANT:')) {
        if (currentParagraphs.length > 0) {
          sections.push({
            id: `qr-p-${i}`,
            type: 'paragraph',
            content: currentParagraphs.join('\n'),
          });
          currentParagraphs = [];
        }
        sections.push({
          id: `qr-c-${i}`,
          type: 'callout',
          content: line.replace(/^>\s*/, ''),
        });
      } else {
        currentParagraphs.push(line);
      }
    }

    if (currentParagraphs.length > 0) {
      sections.push({
        id: 'qr-p-last',
        type: 'paragraph',
        content: currentParagraphs.join('\n'),
      });
    }

    // Add metadata callout at bottom
    sections.push({
      id: 'qr-meta-bottom',
      type: 'callout',
      content: `📌 Scanned from QR Code on ${new Date().toLocaleString()} (${text.length} characters).`,
    });

    return {
      raw: text,
      type: 'markdown',
      title,
      subtitle: `Imported Text Document (${lines.length} lines)`,
      suggestedSections: sections,
      qrImageDataUrl: qrImage,
    };
  }

  // 7. Single Short Plain Text / Code
  const defaultTitle = text.length < 40 ? text : 'Scanned QR Code Record';
  return {
    raw: text,
    type: 'text',
    title: defaultTitle,
    subtitle: `Raw Text Payload (${text.length} chars)`,
    suggestedSections: [
      {
        id: 'qr-single-head',
        type: 'heading',
        content: defaultTitle,
      },
      {
        id: 'qr-single-callout',
        type: 'callout',
        content: text,
      },
      {
        id: 'qr-single-para',
        type: 'paragraph',
        content: `This raw content was imported via QR code scan on ${new Date().toLocaleString()}.`,
      },
    ],
    qrImageDataUrl: qrImage,
  };
}

/**
 * Sample QR Code presets for testing and demos
 */
export const SAMPLE_QR_PRESETS = [
  {
    id: 'sample-url',
    label: 'Web Reference URL',
    icon: 'globe',
    desc: 'Official technical documentation & PDF specification',
    payload: 'https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API',
  },
  {
    id: 'sample-doc',
    label: 'Project Brief (Markdown)',
    icon: 'file-text',
    desc: 'Multi-section project charter with milestones & deliverables',
    payload: `# Project Titan • Technical Charter
## 1. Executive Mission
Deliver military-grade offline document generation and cryptographic signing for enterprise mobile teams.

## 2. Key Deliverables
- Real-time QR Code scanning and intelligent content synthesis
- Zero-telemetry client-side processing sandbox
- Vector-grade typography and aesthetic layout formatting

> Note: Certified for field inspection and compliance verification.`,
  },
  {
    id: 'sample-vcard',
    label: 'Digital Business Card (vCard)',
    icon: 'user',
    desc: 'Contact information for Dr. Elena Vance (Lead Architect)',
    payload: `BEGIN:VCARD
VERSION:3.0
FN:Dr. Elena Vance
TITLE:Principal Systems Architect
ORG:Titan Core Engineering Inc.
EMAIL:elena.vance@titancore.dev
TEL:+1-555-019-2834
NOTE:Mobile Document Technologies Division
END:VCARD`,
  },
  {
    id: 'sample-wifi',
    label: 'Wi-Fi Guest Access Pass',
    icon: 'wifi',
    desc: 'High-speed guest lounge credentials',
    payload: 'WIFI:S:Enterprise_Guest_5G;T:WPA;P:AlphaOmegaSecure2026;;',
  },
];
