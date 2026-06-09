import * as yaml from "js-yaml";
import type {
  LawFrontmatter,
  LawRecord,
  ArticleChunk,
  Jurisdiction,
} from "../types/index.js";

/**
 * Parse YAML frontmatter from a law file.
 * Throws on missing required fields or malformed YAML.
 */
export function parseFrontmatter(
  content: string,
  filePath: string,
): LawFrontmatter {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error(`No YAML frontmatter found in ${filePath}`);
  }

  const frontmatterText = frontmatterMatch[1];
  let frontmatter: Record<string, unknown>;

  try {
    frontmatter = yaml.load(frontmatterText, {
      schema: yaml.FAILSAFE_SCHEMA, // Keep dates as strings
    }) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Failed to parse YAML frontmatter in ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Validate required fields
  const requiredFields: Array<keyof LawFrontmatter> = [
    "identifier",
    "title",
    "country",
    "last_updated",
    "status",
  ];

  for (const field of requiredFields) {
    if (!frontmatter[field as keyof LawFrontmatter]) {
      throw new Error(
        `Missing required field '${String(field)}' in frontmatter of ${filePath}`,
      );
    }
  }

  return frontmatter as LawFrontmatter;
}

/**
 * Extract Markdown body after frontmatter.
 */
export function extractMarkdownBody(content: string): string {
  const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n?/);
  if (!frontmatterMatch) {
    return content; // No frontmatter, return entire content
  }

  return content.slice(frontmatterMatch[0].length);
}

/**
 * Chunk Markdown into article/section records.
 * Parses headings and article numbers to create stable chunks.
 */
export function chunkMarkdown(
  markdown: string,
  lawIdentifier: string,
  jurisdiction: string,
  sourceRevision: string,
  legalizePath: string,
): ArticleChunk[] {
  const chunks: ArticleChunk[] = [];
  const lines = markdown.split("\n");
  let currentArticle: string | null = null;
  let currentHeadingPath: string[] = [];
  let currentText: string[] = [];
  let chunkIndex = 0;

  const saveCurrentChunk = () => {
    if (!currentArticle) {
      return;
    }

    const text = currentText.join("\n").trim();
    currentText = [];

    if (text.length === 0) {
      return;
    }

    chunks.push({
      law_identifier: lawIdentifier,
      jurisdiction,
      article_number: currentArticle,
      heading_path: [...currentHeadingPath],
      text,
      source_revision: sourceRevision,
      legalize_path: legalizePath,
      chunk_index: chunkIndex++,
    });
  };

  // Article pattern: Artículo/Articulo followed by number, ordinal, cardinal, or "único", with optional Latin suffixes
  // Matches: "Artículo 1", "Articulo 1", "Artículo 1º", "Artículo 2ª", "Artículo único", "Artículo 10 bis", "Artículo 38 ter"
  // Suffixes: bis, ter, quater, quinquies, sexies, septies, octies, nonies
  const articlePattern = /^Art[íi]culo\s+(\d+[ººªª]?\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|nonies)?|(?:[uú]nico))/i;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check for article pattern first (with or without heading markers)
    const articleWithHeadingMatch = trimmedLine.match(/^#{1,6}\s+Art[íi]culo\s+(\d+[ººªª]?\s*(?:bis|ter|quater|quinquies|sexies|septies|octies|nonies)?|(?:[uú]nico))/i);
    const articleWithoutHeadingMatch = trimmedLine.match(articlePattern);
    
    const headingMatch = !articleWithHeadingMatch && !articleWithoutHeadingMatch 
      ? trimmedLine.match(/^(#{1,6})\s+(.+)$/) 
      : null;

    if (articleWithHeadingMatch || articleWithoutHeadingMatch) {
      saveCurrentChunk();

      // Extract article number
      const articleNumber = articleWithHeadingMatch 
        ? articleWithHeadingMatch[1] 
        : articleWithoutHeadingMatch![1];
      currentArticle = articleNumber;

      // If article has heading marker, update heading path
      if (articleWithHeadingMatch) {
        const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const headingText = headingMatch[2].trim();
          currentHeadingPath = currentHeadingPath.slice(0, level - 1);
          currentHeadingPath.push(headingText);
        }
      }
    } else if (headingMatch) {
      saveCurrentChunk();

      // Update heading path
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      currentHeadingPath = currentHeadingPath.slice(0, level - 1);
      currentHeadingPath.push(headingText);
    } else {
      if (currentArticle) {
        currentText.push(line);
      }
    }
  }

  saveCurrentChunk();

  return chunks;
}

/**
 * Convert frontmatter to a law record with source URLs.
 */
export function frontmatterToLawRecord(
  frontmatter: LawFrontmatter,
  filePath: string,
  sourceRevision: string,
  jurisdiction: Jurisdiction,
): LawRecord {
  const identifier = frontmatter.identifier;
  const legalizePath = filePath;

  // Build GitHub URLs
  const githubUrl = `https://github.com/legalize-dev/legalize-es/blob/${sourceRevision}/${legalizePath}`;
  const rawUrl = `https://raw.githubusercontent.com/legalize-dev/legalize-es/${sourceRevision}/${legalizePath}`;

  // Build BOE URL if identifier looks like a BOE reference
  let boeUrl: string | null = null;
  if (identifier.match(/^BOE-[A-Z]-\d{4}-\d+$/)) {
    boeUrl = `https://www.boe.es/buscar/act.php?id=${identifier}`;
  }

  return {
    identifier,
    title: frontmatter.title,
    jurisdiction,
    status: frontmatter.status,
    rank: frontmatter.rank ?? null,
    publication_date: frontmatter.publication_date ?? null,
    last_updated: frontmatter.last_updated,
    source_revision: sourceRevision,
    legalize_path: legalizePath,
    github_url: githubUrl,
    raw_url: rawUrl,
    boe_url: boeUrl,
    eli_url: frontmatter.url_eli ?? null,
    url_html_consolidada: frontmatter.url_html_consolidada ?? null,
    url_pdf: frontmatter.url_pdf ?? null,
    department: frontmatter.department ?? null,
    subjects: frontmatter.subjects ?? null,
    consolidation_status: frontmatter.consolidation_status ?? null,
    scope: frontmatter.scope ?? null,
    frontmatter,
  };
}

/**
 * Validate chunk size and content.
 * Throws if chunk is unexpectedly large or empty.
 */
export function validateChunk(chunk: ArticleChunk): void {
  const maxChunkSize = 100_000; // 100 KB limit per chunk

  if (chunk.text.length === 0) {
    throw new Error(
      `Empty chunk for article ${chunk.article_number} in ${chunk.legalize_path}`,
    );
  }

  if (chunk.text.length > maxChunkSize) {
    throw new Error(
      `Chunk too large (${chunk.text.length} bytes) for article ${chunk.article_number} in ${chunk.legalize_path}`,
    );
  }
}

/**
 * Validate law record metadata.
 * Throws if required fields are missing or invalid.
 */
export function validateLawRecord(record: LawRecord): void {
  if (!record.identifier) {
    throw new Error("Law record missing identifier");
  }

  if (!record.title) {
    throw new Error("Law record missing title");
  }

  if (!record.jurisdiction) {
    throw new Error("Law record missing jurisdiction");
  }

  if (!record.status) {
    throw new Error("Law record missing status");
  }

  if (!record.last_updated) {
    throw new Error("Law record missing last_updated");
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (record.publication_date && !dateRegex.test(record.publication_date)) {
    throw new Error(
      `Invalid publication_date format: ${record.publication_date}`,
    );
  }

  if (!dateRegex.test(record.last_updated)) {
    throw new Error(`Invalid last_updated format: ${record.last_updated}`);
  }
}

/**
 * Parse a complete law file into law record and article chunks.
 */
export function parseLawFile(
  content: string,
  filePath: string,
  sourceRevision: string,
): {
  law: LawRecord;
  chunks: ArticleChunk[];
  reforms: any[];
} {
  const frontmatter = parseFrontmatter(content, filePath);
  const body = extractMarkdownBody(content);
  
  // Extract jurisdiction from file path (e.g., "es/BOE-A-1889-4763.md" -> "es")
  const jurisdictionMatch = filePath.match(/^([a-z]{2}(?:-[a-z]{2})?)/);
  const jurisdiction = (jurisdictionMatch?.[1] as Jurisdiction) || "es";
  
  const law = frontmatterToLawRecord(frontmatter, filePath, sourceRevision, jurisdiction);
  const chunks = chunkMarkdown(body, law.identifier, jurisdiction, sourceRevision, filePath);
  
  // Validate
  validateLawRecord(law);
  for (const chunk of chunks) {
    validateChunk(chunk);
  }
  
  return {
    law,
    chunks,
    reforms: [], // Reforms are extracted separately from git history
  };
}
