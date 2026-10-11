import { execFile } from 'child_process'

export function execFilePromise(
  bin: string,
  args: string[],
  options?: { timeout?: number; env?: NodeJS.ProcessEnv }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const cb = (err: Error | null, stdout: string | Buffer, stderr: string | Buffer): void => {
      if (err) {
        reject(err)
        return
      }
      resolve({ stdout: stdout as string, stderr: stderr as string })
    }

    if (options?.timeout || options?.env) {
      execFile(bin, args, options, cb)
    } else {
      execFile(bin, args, cb)
    }
  })
}
