import { describe, expect, it } from 'vitest';
import { openFailedDialog, projectPathFromArgv, replaceDialog } from '../../../src/main/open-file';

describe('replaceDialog', () => {
  it('names the local project and keeps it unless the user picks Replace', () => {
    const options = replaceDialog('en', 'Quest');
    expect(options.message).toContain('"Quest"');
    expect(options.buttons).toEqual(['Keep mine', 'Replace']);
    expect(options.defaultId).toBe(0);
    expect(options.cancelId).toBe(0);
  });
});

describe('openFailedDialog', () => {
  it('shows the file that could not be opened', () => {
    const options = openFailedDialog('en', 'D:\\Games\\Quest.loopy');
    expect(options.type).toBe('error');
    expect(options.message).toBe('The project could not be opened.');
    expect(options.detail).toBe('D:\\Games\\Quest.loopy');
  });
});

describe('projectPathFromArgv', () => {
  it('finds a project file passed by Explorer to the installed app', () => {
    expect(projectPathFromArgv(['C:\\Loopy\\Loopy.exe', 'D:\\Games\\Quest.loopy'])).toBe(
      'D:\\Games\\Quest.loopy',
    );
  });

  it('finds a project file after the app path in an unpacked run', () => {
    expect(projectPathFromArgv(['electron.exe', '.', '/tmp/Quest.LOOPY'])).toBe('/tmp/Quest.LOOPY');
  });

  it('ignores switches, even ones that end in .loopy', () => {
    expect(projectPathFromArgv(['Loopy.exe', '--inspect', '--file=a.loopy'])).toBeNull();
  });

  it('returns null when no project file is passed', () => {
    expect(projectPathFromArgv(['Loopy.exe'])).toBeNull();
    expect(projectPathFromArgv([])).toBeNull();
  });
});
