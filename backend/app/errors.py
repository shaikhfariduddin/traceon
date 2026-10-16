class AppError(Exception):
    """Business-rule or permission failure that should reach the client as a clear message."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message
