import Papa from "papaparse";

export async function parseCSV<T>(filePath: string): Promise<T[]> {
  const response = await fetch(filePath);
  const csvText = await response.text();
  
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      delimiter: "", // Auto-detect
      complete: (results) => {
        resolve(results.data as T[]);
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}
