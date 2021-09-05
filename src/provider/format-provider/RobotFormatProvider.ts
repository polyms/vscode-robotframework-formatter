'use strict'

import { CancellationToken, DocumentFormattingEditProvider, FormattingOptions, Range, TextDocument, TextEdit } from 'vscode';

enum Type {
    Resource = 0,
    Body,
    Name,
    Comment,
    Empty,
    Block,
    Keyword,
    Undefined
}

function multiplyString(base: string, times: number): string {
    let result = '';
    for (let i = 0; i < times; i++) {
        result += base;
    }
    return result;
}

function getEmptyArrayOfString(length: number): string[] {
    let str = new Array(length);
    for (let i = 0; i < length; i++) {
        str[i] = "";
    }
    return str;
}

function documentEditor(ranges: Range[], newStr: string[]): TextEdit[] {
    let editor: TextEdit[] = [];
    for (let i = 0; i < newStr.length; i++) {
        editor.push(new TextEdit(ranges[i], newStr[i]));
    }
    return editor;
}
export class RobotFormatProvider implements DocumentFormattingEditProvider {

    public provideDocumentFormattingEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken): Thenable<TextEdit[]> | TextEdit[] {
        let ranges = RobotFormatProvider.getAllLineRange(document);
        let formatted = RobotFormatProvider.groupFormat(document);
        return documentEditor(ranges, formatted);
    }

    private static getAllLineRange(document: TextDocument): Range[] {
        let ranges: Range[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            let range = document.lineAt(i).range;
            ranges.push(range);
        }
        return ranges;
    }

    //Group format
    private static groupFormat(document: TextDocument): string[] {
        const lines = new Array<string>(document.lineCount + 1);
        const lineTypes = new Array<Type>(document.lineCount + 1);
        for (let i = 0; i < document.lineCount; i++) {
            lines[i] = document.lineAt(i).text;
            lineTypes[i] = RobotFormatProvider.getLineType(lines[i]);
        }
        lines[lines.length - 1] = '';

        let bucket: number[] = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trimRight();
            const type = lineTypes[i];
            if (type == Type.Name || type == Type.Empty || type == Type.Block || /^\s+END/.test(line)) {
                if (bucket.length > 0) {
                    const columns = RobotFormatProvider.identifyBucketColumns(bucket, lines);
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
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i] as string;
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
        }

        lines.splice(lines.length - 1);
        return lines;
    }

    private static identifyBucketColumns(bucket: number[], lines: string[]): number[] {
        let columns = [];

        for (var index of bucket) {
            let line = lines[index];
            let arr = line.split(/\s{2,}/);
            for (let i = columns.length; i < arr.length; i++) {
                columns.push(0);
            }
            for (let i = 0; i < arr.length; i++) {
                columns[i] = columns[i] < arr[i].length
                    ? arr[i].length
                    : columns[i];
            }
        }

        if (lines[bucket[0]].trim().split(/\s{2,}/).length == 1 &&
            bucket.slice(1).every(inx => /^\s*\.\.\./.test(lines[inx]))) {
            columns[1] = 3;
        }

        return columns;
    }

    private static formatBucket(bucket: number[], columns: number[], lines: string[]) {
        for (let index of bucket) {
            lines[index] = RobotFormatProvider.formatLine(lines[index], columns);
        }
    }

    private static formatLine(line: string, columns: number[]): string {
        let arr = line.split(/\s{2,}/);

        for (let i = 0; i < arr.length; i++) {

            arr[i] = arr[i] + (i == arr.length - 1
                ? ''
                : multiplyString(' ', columns[i] - arr[i].length));
        }
        return arr.join('    ');
    }

    private static getLineType(line: string): Type {
        let l = line.replace(/\s+$/, "");
        if (/^\S+/.test(l)) {
            if (l.replace(/^\\\s+/, "\\ ").split(/\s{2,}/).length > 1) {
                return Type.Resource;
            } else {
                return Type.Name
            }
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
        let formatted: string[] = getEmptyArrayOfString(document.lineCount);
        let formatCode: number[] = [];
        let temp: string[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            let line = document.lineAt(i).text;
            temp.push(line.replace(/\s+$/, ""));
            if (/^\S+/.test(line)) {
                if (line.replace(/\s+$/, "").replace(/^\\\s+/, "\\ ").split(/\s{2,}/).length > 1) {
                    formatCode.push(0);
                }
                else {
                    formatCode.push(2);
                }
            }
            else if (/^\s*$/.test(line)) {
                formatCode.push(4);
            }
            else if (/^\s*#/.test(line)) {
                formatCode.push(2);
            }
            else if (/^\s*:/.test(line)) {
                formatCode.push(3)
            }
            else {
                formatCode.push(1);
            }
        }
        let lengthGuide: number[][] = RobotFormatProvider.getLengthGuide(temp, formatCode);
        for (let i = 0; i < temp.length; i++) {
            let line = temp[i];
            if (formatCode[i] == 0 || formatCode[i] == 1) {
                let sentences: string[];
                let guide = formatCode[i];
                if (formatCode[i] == 1) {
                    formatted[i] = "    ";
                    sentences = line.replace(/^\s+/, "").replace(/^\\\s+/, "\\ ").split(/\s{2,}/);
                }
                else {
                    sentences = line.split(/\s{2,}/);
                }
                for (let j = 0; j < sentences.length; j++) {
                    let sentence = sentences[j].replace(/\\\s/, "\\    ");
                    while (sentence.length < lengthGuide[guide][j] && j < sentences.length - 1) {
                        sentence = sentence + " ";
                    }
                    formatted[i] = formatted[i] + sentence;
                }
            }
            else if (formatCode[i] == 2) {
                formatted[i] = line;
            }
            else if (formatCode[i] == 3) {
                let sentences = line.replace(/^\s+/, "").split(/\s{2,}/);
                formatted[i] = "    ";
                for (let j = 0; j < sentences.length; j++) {
                    let sentence = sentences[j];
                    formatted[i] = formatted[i] + sentence
                    if (j < sentences.length - 1) {
                        formatted[i] = formatted[i] + "  ";
                    }
                }
            }
        }
        return formatted;
    }

    private static getLengthGuide(lines: string[], formatCode: number[]): number[][] {
        let guides: number[][] = [];
        guides.push([]);
        guides.push([]);
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (formatCode[i] == 0 || formatCode[i] == 1) {
                let sentences: string[];
                let code = formatCode[i];
                if (code == 1) {
                    sentences = line.replace(/^\s+/, "").replace(/^\\\s+/, "\\ ").split(/\s{2,}/);
                }
                else {
                    sentences = line.split(/\s{2,}/);
                }
                for (let j = 0; j < sentences.length; j++) {
                    let sentence = sentences[j].replace(/^\\\s/, "\\    ");
                    if (j == sentences.length - 1 && /^#/.test(sentence)) {
                        break;
                    }
                    if (guides[code].length == j) {
                        guides[code].push(sentence.length + 4);
                    }
                    else if (guides[code][j] < sentence.length + 4) {
                        guides[code][j] = sentence.length + 4;
                    }
                }
            }
        }
        return guides;
    }

    // End All code format

}
