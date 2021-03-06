'use strict';
import * as vscode from 'vscode';
import { CommandRunner, ICommand } from './commandRunner';
import { ERROR_AND_WARNING } from './configuration';
import opn = require('opn');
const INIT_COMMAND_DOC = 'https://developer.amazon.com/docs/smapi/ask-cli-command-reference.html#init-command';
const execa = require('execa');

const NULL_AWS_PROFILE = '** NULL **';
const ENVIRONMENT_VARIABLE_USED_FOR_AWS = '__AWS_CREDENTIALS_IN_ENVIRONMENT_VARIABLE__';

export class ProfileManager {
    private static cachedProfileList: IProfile[] = [];

    /**
     * initalized the profile manager. The profile manager will cache the profile list
     * if they are existed, or show an error message with an option to initaizled the ASK CLI
     */
    public static init() {
        try {
            const listProfileOutput = execa.shellSync('ask init -l');
            if ((listProfileOutput.stderr && listProfileOutput.stderr.includes(ERROR_AND_WARNING.EMPTY_PROFILE_MESSAGE)) || listProfileOutput.stdout.trim().length === 0) {
                return;
            }
            const profileOutputStrings = listProfileOutput.stdout.split('\n');
            const profileTree = profileOutputStrings.filter(this.takeOutHeaderAndEnding).map(this.extractProfilesFromCliOutput);
            if (!profileTree || profileTree.length === 0) {
                return;
            } else {
                this.cachedProfileList = profileTree;
            }
        } catch (error) {
            throw new Error('ASK CLI is not functional. ' + error.message);
        }
    }

    /**
     * parse the profile from CLI to a list of profile object that can be stored.
     * @param profileString the output string from ASK CLI. i.e., [askProfile]   "awsProfile".
     */
    private static extractProfilesFromCliOutput(profileString:string) {
        const profiles = profileString.split(/\]/);
        const askProfile = profiles[0].split(/\[/)[1];
        const result = <IProfile> {
            askProfile: askProfile,
            awsProfile: null
        };
        const restProfileString = profiles[1];
        if (restProfileString.includes(NULL_AWS_PROFILE)) {
            result.awsProfile = null;
        } else if (restProfileString.includes(ENVIRONMENT_VARIABLE_USED_FOR_AWS)) {
            result.awsProfile = 'ENVIRONMENT VARIABLE';
        } else {
            const awsProfile = restProfileString.trim().replace(/\"/g, '');
            result.awsProfile = awsProfile;
        }
        return result;
    }

    /**
     * Remove the first line (header) and last line (empty spaces) from the ASK CLI output list.
     * @param input entire output from ASK CLI
     */
    private static takeOutHeaderAndEnding(input: string) {
        if (input.length === 0 || input.includes('Associated AWS Profile')) {
            return false;
        } 
        return true;
    }

    /**
     * show no profile exists message and a button that can trigger the 'ask init' process
     */
    public static async showProfileMissingAndSetupNotice() {
        const action = await vscode.window.showErrorMessage(ERROR_AND_WARNING.SUGGEST_INIT_CLI, ERROR_AND_WARNING.INIT_CLI_ACTION);
        if (action === ERROR_AND_WARNING.INIT_CLI_ACTION) {
            CommandRunner.runCommand( <ICommand>{
                command: 'init'
            });
            opn(INIT_COMMAND_DOC);
        }
    }

    public static async getProfileList() {
        if (this.cachedProfileList.length === 0) {
            this.init();
        }
        // pass a new copy of the list
        return this.cachedProfileList.slice(0);
    }

    /**
     * clear the profile cache
     */
    public static clearCachedProfile() {
        this.cachedProfileList = [];
    }
}

export interface IProfile {
    askProfile: string;
    awsProfile: string | null;
}
