import { basename, extname, join } from 'path';
import { unlink } from 'fs';
import { URL } from 'url';
import https from 'https';
import config from 'config';
import { makeAmbientLight, makeDirectionalLight, makeStandardMaterial, stl2png } from '@scalenc/stl-to-png';

const TMP: string = config.get('temporaryFolder');
const VALID_FORMAT: string[] = config.get('validFormat');
const ALLOWED_ORIGINS: string[] = config.get('allowedOrigins');

export function parseLink(link: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let url: URL;
    let baseName: string;

    try {
      const result = validateLink(link);
      url = result.url;
      baseName = result.baseName;
    } catch (err) {
      return reject(err);
    }

    const request = https.get(url, response => {
      if (response.statusCode === 200) {
        const tmpBuffer: any = [];
        response.on("error", err => reject(`error converting stream - ${err}`));
        response.on('data', chunk => tmpBuffer.push(chunk));
        response.on('end', () => {
          return resolve(stl2png(Buffer.concat(tmpBuffer), {
            height: 500,
            width: 500,
            cameraPosition: [95, 75, 162],
            lights: [makeAmbientLight(0xffffff), makeDirectionalLight(1, 1, 1, 0xffffff, 1.35), makeDirectionalLight(0.5, 1, -1, 0xffffff, 1)],
            materials: [makeStandardMaterial(1, 0xfad82c)],
            edgeMaterials: [makeStandardMaterial(0.7, 0x000000)]
          }))
        });
      } else {
        console.error(`Response status: ${response.statusCode}.`)
        return reject(new ParserError(ParseError.DOWNLOAD_ERROR, 'An error occured while downloading the file.'));
      }
    })

    request.on('error', err => {
      console.error(err);
      return reject(new ParserError(ParseError.DOWNLOAD_ERROR, 'An error occured while downloading the file.'));
    })
  })
}

export async function clear(picturePath: string) {
  const extensionsToDelete = ['.scad', '.png'].concat(config.get('validFormat'));
  const baseName = basename(picturePath);
  const fileName = basename(baseName, extname(baseName));

  extensionsToDelete.forEach(ext => {
    unlink(join(TMP, fileName + ext), err => {
      if (err) console.error(err);
    });
  });
}

export function validateLink(link: string) {
  const url = new URL(link);
  const baseName = basename(url.pathname);

  if (!ALLOWED_ORIGINS.includes(url.origin)) {
    throw (new ParserError(ParseError.FORBIDDEN_DOMAIN, `Domain \`${url.origin}\` is not allowed.`));
  }

  if (!VALID_FORMAT.includes(extname(baseName))) {
    throw (new ParserError(ParseError.INVALID_FORMAT, `File type \`${extname(baseName)}\` is not allowed.`));
  }

  return { url, baseName }
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