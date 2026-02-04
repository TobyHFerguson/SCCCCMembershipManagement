
declare namespace VotingService.Data {
    function getValidatedResultsSheet(spreadsheetId: string): GoogleAppsScript.Spreadsheet.Sheet | undefined;
    function getVoters_(election: VotingService.Election): string[];
    function hasVotedAlreadyInThisElection(email: string, election: VotingService.Election): boolean;
    function storeElectionData(elections: VotingService.Election[]): void;
    function getElectionData(): VotingService.Election[];
}
