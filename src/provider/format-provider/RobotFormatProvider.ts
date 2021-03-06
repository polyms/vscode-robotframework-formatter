import {
  DocumentFormattingEditProvider,
  Range,
  TextDocument,
  TextEdit,
} from 'vscode';

enum Type {
  Resource = 0,
  Body,
  Name,
  Comment,
  Empty,
  Block,
  Keyword,
  Undefined,
}

function multiplyString(base: string, times: number): string {
  let result = '';
  for (let i = 0; i < times; i += 1) {
    result += base;
  }
  return result;
}

function getEmptyArrayOfString(length: number): string[] {
  const str = new Array(length);
  for (let i = 0; i < length; i += 1) {
    str[i] = '';
  }
  return str;
}

function documentEditor(ranges: Range[], newStr: string[]): TextEdit[] {
  const editor: TextEdit[] = [];
  for (let i = 0; i < newStr.length; i += 1) {
    editor.push(new TextEdit(ranges[i], newStr[i]));
  }
  return editor;
}
export class RobotFormatProvider implements DocumentFormattingEditProvider {
  public provideDocumentFormattingEdits(
    document: TextDocument,
    // options: FormattingOptions,
    // token: CancellationToken,
  ): Thenable<TextEdit[]> | TextEdit[] {
    const ranges = RobotFormatProvider.getAllLineRange(document);
    const formatted = RobotFormatProvider.groupFormat(document);
    return documentEditor(ranges, formatted);
  }

  private static getAllLineRange(document: TextDocument): Range[] {
    const ranges: Range[] = [];
    for (let i = 0; i < document.lineCount; i += 1) {
      const { range } = document.lineAt(i);
      ranges.push(range);
    }
    return ranges;
  }

  // Group format
  private static groupFormat(document: TextDocument): string[] {
    const lines = new Array<string>(document.lineCount + 1);
    const lineTypes = new Array<Type>(document.lineCount + 1);
    for (let i = 0; i < document.lineCount; i += 1) {
      lines[i] = document.lineAt(i).text;
      lineTypes[i] = RobotFormatProvider.getLineType(lines[i]);
    }
    lines[lines.length - 1] = '';

    let bucket: number[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const type = lineTypes[i];
      if (
        type == Type.Name
        || type == Type.Empty
        || type == Type.Block
        || /^\s+END/.test(line)
      ) {
        if (bucket.length > 0) {
          const columns = RobotFormatProvider.identifyBucketColumns(
            bucket,
            lines,
          );
          RobotFormatProvider.formatBucket(bucket, columns, lines);
        }

        lines[i] = line.split(/\s{2,}/).join('    ');
        bucket = [];
      } else if (type == Type.Comment) {
        lines[i] = line;
      } else {
        bucket.push(i);
      }
    }

    let indentLevel = 1;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] as string;
      if (/^\s*(END)/.test(line)) {
        indentLevel -= 1;
      }
      if (indentLevel > 1) {
        if (/^\s+(ELSE)/.test(line)) {
          lines[i] = new Array((indentLevel - 1) * 4).fill(' ').join('') + line.trim();
          if (/^\s+ELSE\sIF/.test(line)) {
            lines[i] = lines[i].replace('ELSE IF', 'ELSE IF    ');
          }
        } else {
          lines[i] = new Array(indentLevel * 4).fill(' ').join('') + line.trim();
        }
      }
      if (lineTypes[i] == Type.Block) {
        indentLevel += 1;
      }

      lines[i] = lines[i].trimRight();

      if (i > 2 && lines[i].startsWith('***')) {
        if (lines[i - 1] !== '') lines[i] = '\n\n' + lines[i];
        else if (lines[i - 2] !== '') lines[i] = '\n' + lines[i];
      }
    }

    lines.splice(lines.length - 1);
    return lines;
  }

  private static identifyBucketColumns(
    bucket: number[],
    lines: string[],
  ): number[] {
    const columns: number[] = [];

    bucket.forEach((index) => {
      const line = lines[index];
      const arr = line.split(/\s{2,}/);
      for (let i = columns.length; i < arr.length; i += 1) {
        columns.push(0);
      }
      for (let i = 0; i < arr.length; i += 1) {
        columns[i] = columns[i] < arr[i].length ? arr[i].length : columns[i];
      }
    });

    if (
      lines[bucket[0]].trim().split(/\s{2,}/).length == 1
      && bucket.slice(1).every((inx) => /^\s*\.\.\./.test(lines[inx]))
    ) {
      columns[1] = 3;
    }

    return columns;
  }

  private static formatBucket(
    bucket: number[],
    columns: number[],
    lines: string[],
  ) {
    bucket.forEach((index) => {
      lines[index] = RobotFormatProvider.formatLine(lines[index], columns);
    });
  }

  private static formatLine(line: string, columns: number[]): string {
    const arr = line.split(/\s{2,}/);

    for (let i = 0; i < arr.length; i += 1) {
      arr[i] += (i == arr.length - 1
        ? ''
        : multiplyString(' ', columns[i] - arr[i].length));
    }
    return arr.join('    ');
  }

  private static getLineType(line: string): Type {
    const l = line.replace(/\s+$/, '');
    if (/^\S+/.test(l)) {
      if (l.replace(/^\\\s+/, '\\ ').split(/\s{2,}/).length > 1) {
        return Type.Resource;
      }
      return Type.Name;
    }
    if (l.length == 0) {
      return Type.Empty;
    }
    if (/^\s*#/.test(l)) {
      return Type.Comment;
    }
    if (/^\s*(FOR|IF)/.test(l)) {
      return Type.Block;
    }
    // if (/^\s+\[.*?\]/.test(l)) {     return Type.Keyword; }
    return Type.Body;
  }

  // End group format

  // Begin All file format
  private static getFormattedLines(document: TextDocument): string[] {
    const formatted: string[] = getEmptyArrayOfString(document.lineCount);
    const formatCode: number[] = [];
    const temp: string[] = [];
    for (let i = 0; i < document.lineCount; i += 1) {
      const line = document.lineAt(i).text;
      temp.push(line.replace(/\s+$/, ''));
      if (/^\S+/.test(line)) {
        if (
          line
            .replace(/\s+$/, '')
            .replace(/^\\\s+/, '\\ ')
            .split(/\s{2,}/).length > 1
        ) {
          formatCode.push(0);
        } else {
          formatCode.push(2);
        }
      } else if (/^\s*$/.test(line)) {
        formatCode.push(4);
      } else if (/^\s*#/.test(line)) {
        formatCode.push(2);
      } else if (/^\s*:/.test(line)) {
        formatCode.push(3);
      } else {
        formatCode.push(1);
      }
    }
    const lengthGuide: number[][] = RobotFormatProvider.getLengthGuide(
      temp,
      formatCode,
    );
    for (let i = 0; i < temp.length; i += 1) {
      const line = temp[i];
      if (formatCode[i] == 0 || formatCode[i] == 1) {
        let sentences: string[];
        const guide = formatCode[i];
        if (formatCode[i] == 1) {
          formatted[i] = '    ';
          sentences = line
            .replace(/^\s+/, '')
            .replace(/^\\\s+/, '\\ ')
            .split(/\s{2,}/);
        } else {
          sentences = line.split(/\s{2,}/);
        }
        for (let j = 0; j < sentences.length; j += 1) {
          let sentence = sentences[j].replace(/\\\s/, '\\    ');
          while (
            sentence.length < lengthGuide[guide][j]
            && j < sentences.length - 1
          ) {
            sentence += ' ';
          }
          formatted[i] += sentence;
        }
      } else if (formatCode[i] == 2) {
        formatted[i] = line;
      } else if (formatCode[i] == 3) {
        const sentences = line.replace(/^\s+/, '').split(/\s{2,}/);
        formatted[i] = '    ';
        for (let j = 0; j < sentences.length; j += 1) {
          const sentence = sentences[j];
          formatted[i] += sentence;
          if (j < sentences.length - 1) {
            formatted[i] = `${formatted[i]}  `;
          }
        }
      }
    }
    return formatted;
  }

  private static getLengthGuide(
    lines: string[],
    formatCode: number[],
  ): number[][] {
    const guides: number[][] = [];
    guides.push([]);
    guides.push([]);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (formatCode[i] == 0 || formatCode[i] == 1) {
        let sentences: string[];
        const code = formatCode[i];
        if (code == 1) {
          sentences = line
            .replace(/^\s+/, '')
            .replace(/^\\\s+/, '\\ ')
            .split(/\s{2,}/);
        } else {
          sentences = line.split(/\s{2,}/);
        }
        for (let j = 0; j < sentences.length; j += 1) {
          const sentence = sentences[j].replace(/^\\\s/, '\\    ');
          if (j == sentences.length - 1 && /^#/.test(sentence)) {
            break;
          }
          if (guides[code].length == j) {
            guides[code].push(sentence.length + 4);
          } else if (guides[code][j] < sentence.length + 4) {
            guides[code][j] = sentence.length + 4;
          }
        }
      }
    }
    return guides;
  }

  // End All code format
}
