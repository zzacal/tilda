import fs from "fs";
import { MockRecord } from "../types/mockRecord";
import path from "path";

export function fromDir(dirPath: string): MockRecord[] {
  return getFiles(dirPath)
    .map((filePath) => {
      console.log("seedFile", filePath);
      return fromFile(path.join(dirPath, filePath));
    })
    .flat();    
} 

export function fromFile(filePath: string): MockRecord[] {
  try {    
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

export function getFiles(directoryPath: string, extension = ".json"): string[] {
  const files = fs.readdirSync(directoryPath);
  const jsonFiles = files.filter(
    (file) => path.extname(file).toLowerCase() === extension
  );
  return jsonFiles;
}
