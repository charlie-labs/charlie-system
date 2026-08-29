/** Swappable FS layer. */
export interface FileSystemIO {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
  delete(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
}
