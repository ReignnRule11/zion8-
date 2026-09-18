import 'api_exception.dart';

/// A discriminated union used at the data-source boundary. Presentation maps
/// this onto Riverpod [AsyncValue].
sealed class Result<T> {
  const Result();

  R when<R>({
    required R Function(T value) ok,
    required R Function(ApiException error) err,
  });
}

class Ok<T> extends Result<T> {
  const Ok(this.value);
  final T value;

  @override
  R when<R>({
    required R Function(T value) ok,
    required R Function(ApiException error) err,
  }) =>
      ok(value);
}

class Err<T> extends Result<T> {
  const Err(this.error);
  final ApiException error;

  @override
  R when<R>({
    required R Function(T value) ok,
    required R Function(ApiException error) err,
  }) =>
      err(error);
}
