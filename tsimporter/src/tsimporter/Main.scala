package tsimporter

import java.io.{ Console => _, Reader => _, _ }

import Trees._

import scala.util.parsing.input._
import parser.TSDefParser
import scala.sys.process._

/** Entry point for the TypeScript importer of Scala.js */
object Main {
  def main(args: Array[String]) {
    for (config <- Config.parser.parse(args, Config())) {
      val outputPackage = config.packageName

      importTsFile(config.inputFileName, config.outputFileName, outputPackage) match {
        case Right(()) =>
          ()
        case Left(message) =>
          Console.err.println(message)
          System.exit(2)
      }
    }
  }

  /**
   * Delegates the conversion to the new TypeScript-based converter implemented in
   * `converter/converter.js` (compiled from `converter/converter.ts`).
   *
   * The converter is executed through Node.js. The method looks for the script
   * starting from the current working directory and walking up the directory
   * tree until it finds a `converter` directory containing `converter.js`.
   *
   * If the script cannot be found or if it exits with a non-zero status, an
   * error is returned.
   */
  def importTsFile(inputFileName: String, outputFileName: String, outputPackage: String): Either[String, Unit] = {
    try {
      val scriptPath = locateConverterScript() // throws if not found

      val exitCode = Process(Seq("node", scriptPath, inputFileName, outputFileName, outputPackage)).!

      if (exitCode == 0 && new File(outputFileName).exists()) Right(())
      else Left(s"TypeScript converter failed with exit code $exitCode")

    } catch {
      case t: Throwable => Left(s"TypeScript converter failed: ${t.getMessage}")
    }
  }

  /** Recursively search upwards from the current working directory for
   *  `converter/converter.js`.
   */
  private def locateConverterScript(): String = {
    @annotation.tailrec
    def loop(dir: File): File = {
      if (dir == null)
        throw new FileNotFoundException("Could not locate converter/converter.js in parent directories")
      else {
        val candidate = new File(dir, "converter/converter.js")
        if (candidate.exists()) candidate
        else loop(dir.getParentFile)
      }
    }

    loop(new File(System.getProperty("user.dir"))).getCanonicalPath
  }

  private def process(definitions: List[DeclTree], output: PrintWriter,
      outputPackage: String) {
    new Importer(output)(definitions, outputPackage)
  }

  private def parseDefinitions(reader: Reader[Char]): Either[String, List[DeclTree]] = {
    val parser = new TSDefParser
    parser.parseDefinitions(reader) match {
      case parser.Success(rawCode, _) =>
        Right(rawCode)

      case parser.NoSuccess(msg, next) =>
        Left(
            "Parse error at %s\n".format(next.pos.toString) +
            msg + "\n" +
            next.pos.longString)
    }
  }
}
