import { describe, expect, it } from 'vitest';
import {
  openFailedDialog,
  projectPathFromArgv,
  saveChangesDialog,
  saveChoice,
} from '../../../src/main/open-file';

describe('saveChangesDialog', () => {
  it("names the project and offers Save, Don't save and Cancel, with Cancel on Escape", () => {
    const options = saveChangesDialog('en', 'Quest');
    expect(options.message).toContain('"Quest"');
    expect(options.buttons).toEqual(['Save', "Don't save", 'Cancel']);
    expect(options.defaultId).toBe(0);
    expect(options.cancelId).toBe(2);
    expect(options.noLink).toBe(true);
  });

  it('maps each button to a choice', () => {
    expect(saveChoice(0)).toBe('save');
    expect(saveChoice(1)).toBe('discard');
    expect(saveChoice(2)).toBe('cancel');
    expect(saveChoice(7)).toBe('cancel');
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
