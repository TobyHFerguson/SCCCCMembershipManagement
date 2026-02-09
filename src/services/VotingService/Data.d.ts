
declare namespace VotingService.Data {
    function getValidatedResultsSheet(spreadsheetId: string): GoogleAppsScript.Spreadsheet.Sheet | undefined;
    function hasVotedAlreadyInThisElection(email: string, election: ValidatedElection): boolean;
    function storeElectionData(elections: ValidatedElection[]): void;
    function getElectionData(): ValidatedElection[];
}
