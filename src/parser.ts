import { execFileSync } from 'child_process';
import { basename, extname, join } from 'path';
import { createWriteStream, writeFileSync, unlink } from 'fs';
import { URL } from 'url';
import https from 'https';
import config from 'config';

const TMP: string = config.get('temporaryFolder');
const VALID_FORMAT: string[] = config.get('validFormat');
const ALLOWED_ORIGINS: string[] = config.get('allowedOrigins');

export function parseLink(link: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let url: URL;
    let fileName: string;

    try {
      const result = validateLink(link);
      url = result.url;
      fileName = result.fileName;
    } catch (err) {
      return reject(err);
    }

    const filePath = join(TMP, fileName);
    const file = createWriteStream(filePath);
    const request = https.get(url, response => {
      if (response.statusCode === 200) {
        response.pipe(file);
      } else {
        file.close();
        unlink(filePath, () => { });
        console.error(`Response status: ${response.statusCode}.`)
        return reject(new ParserError(ParseError.DOWNLOAD_ERROR, 'An error occured while downloading the file.'));
      }
    })

    request.on('error', err => {
      console.error(err);
      return reject(new ParserError(ParseError.DOWNLOAD_ERROR, 'An error occured while downloading the file.'));
    })

    file.on('error', err => {
      file.close();
      unlink(filePath, () => { });
      console.error(err);
      return reject(new ParserError(ParseError.DOWNLOAD_ERROR, 'An error occured while downloading the file.'));
    })

    file.on('finish', () => {
      try {
        return resolve(stlToPng(filePath));
      } catch (err) {
        return reject(err);
      }
    })
  })
}

export async function clear(picturePath: string) {
  const extensionsToDelete = ['.stl', '.scad', '.png'];
  const fileName = picturePath.split('/').reverse()[0];
  const baseName = basename(fileName, extname(fileName));

  extensionsToDelete.forEach(ext => {
    unlink(join(TMP, baseName + ext), err => {
      if (err) console.error(err);
    });
  });
}

export function validateLink(link: string) {
  const url = new URL(link);
  const fileName = url.pathname.split('/').reverse()[0];

  if (!ALLOWED_ORIGINS.includes(url.origin)) {
    throw (new ParserError(ParseError.FORBIDDEN_DOMAIN, `Domain \`${url.origin}\` not allowed.`));
  }

  if (!VALID_FORMAT.includes(extname(fileName))) {
    throw (new ParserError(ParseError.INVALID_FORMAT, `File type \`${extname(fileName)}\` not allowed.`));
  }

  return { url, fileName }
}

function stlToPng(filePath: string): string {
  const fileName = basename(filePath, extname(filePath));
  const picturePath = join(TMP, `${fileName}.png`);
  const scadPath = join(TMP, `${fileName}.scad`)
  createScadFile(filePath);

  try {
    execFileSync('utils/OpenSCAD-2019.05-x86_64.AppImage', ['-o', picturePath, '--autocenter', '--viewall', scadPath]);
  } catch (err) {
    console.error(err)
    throw new ParserError(ParseError.CONVERT_ERROR, 'An unknown error occured while generating the preview.')
  }
  return picturePath;
}

function createScadFile(file: string) {
  const fileName = basename(file, extname(file));
  const fileNameExt = basename(file);
  const content = `import("${fileNameExt}");`;
  writeFileSync(`tmp/${fileName}.scad`, content);
}

export enum ParseError {
  FORBIDDEN_DOMAIN = 'FORBIDDEN_DOMAIN',
  DOWNLOAD_ERROR = 'DOWNLOAD_ERROR',
  INVALID_FORMAT = 'INVALID_FORMAT',
  CONVERT_ERROR = 'CONVERT_ERROR'
}

export class ParserError extends Error {
  errorLevel: ParseError;

  constructor(error: ParseError, msg?: string) {
    super(msg);
    this.errorLevel = error;
  }
}