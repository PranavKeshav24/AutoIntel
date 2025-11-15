declare module "adm-zip" {
  interface IZipEntry {
    entryName: string;
    getData(): Buffer;
  }

  export default class AdmZip {
    constructor(filePath?: string | Buffer);
    getEntries(): IZipEntry[];
  }
}
