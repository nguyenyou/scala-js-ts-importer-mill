package tsimporter

import utest._
import java.io.File
import scala.io.Source

object MainTests extends TestSuite {

  def contentOf(file: File): String =
    Source.fromFile(file).getLines.mkString("\n")

  def testTsFile(fileName: String): Unit = {
    // Go up from the sandbox directory to find the project root
    val projectRoot = {
      val currentDir = new File(System.getProperty("user.dir"))
      def findProjectRoot(dir: File): File = {
        if (new File(dir, "samples").exists()) dir
        else if (dir.getParentFile != null) findProjectRoot(dir.getParentFile)
        else throw new RuntimeException("Could not find project root with samples directory")
      }
      findProjectRoot(currentDir)
    }
    val inputDirectory = new File(projectRoot, "samples")
    val outputDir = new File(projectRoot, "target/tsimporter-test")
    
    // Clean and create output directory
    Option(outputDir.listFiles()).foreach(_.foreach(_.delete()))
    outputDir.mkdirs()

    val input = new File(inputDirectory, fileName)
    val expected = new File(inputDirectory, fileName + ".scala")
    val output = new File(outputDir, fileName + ".scala")

    val result = Main.importTsFile(input.getAbsolutePath, output.getAbsolutePath, fileName.takeWhile(_ != '.'))
    
    assert(result == Right(()))
    assert(output.exists())
    assert(contentOf(output) == contentOf(expected))
  }

  def tests = Tests {
    test("should import abstract.d.ts") {
      testTsFile("abstract.d.ts")
    }
    test("should import booleanlit.d.ts") {
      testTsFile("booleanlit.d.ts")
    }
    test("should import comma.d.ts") {
      testTsFile("comma.d.ts")
    }
    test("should import duplicateliteraltypes.d.ts") {
      testTsFile("duplicateliteraltypes.d.ts")
    }
    test("should import enum.d.ts") {
      testTsFile("enum.d.ts")
    }
    test("should import export.d.ts") {
      testTsFile("export.d.ts")
    }
    test("should import exportidentifier.d.ts") {
      testTsFile("exportidentifier.d.ts")
    }
    test("should import extendsintersection.d.ts") {
      testTsFile("extendsintersection.d.ts")
    }
    test("should import extendsobject.d.ts") {
      testTsFile("extendsobject.d.ts")
    }
    test("should import generics.d.ts") {
      testTsFile("generics.d.ts")
    }
    test("should import import.d.ts") {
      testTsFile("import.d.ts")
    }
    test("should import indexabletypes.d.ts") {
      testTsFile("indexabletypes.d.ts")
    }
    test("should import intersectiontype.d.ts") {
      testTsFile("intersectiontype.d.ts")
    }
    test("should import jsglobal.d.ts") {
      testTsFile("jsglobal.d.ts")
    }
    test("should import keyof.d.ts") {
      testTsFile("keyof.d.ts")
    }
    test("should import modifiers.d.ts") {
      testTsFile("modifiers.d.ts")
    }
    test("should import nametranslation.d.ts") {
      testTsFile("nametranslation.d.ts")
    }
    test("should import nestedobjectliteraltypes.d.ts") {
      testTsFile("nestedobjectliteraltypes.d.ts")
    }
    test("should import never.d.ts") {
      testTsFile("never.d.ts")
    }
    test("should import numberlit.d.ts") {
      testTsFile("numberlit.d.ts")
    }
    test("should import objectlit.d.ts") {
      testTsFile("objectlit.d.ts")
    }
    test("should import overrides.d.ts") {
      testTsFile("overrides.d.ts")
    }
    test("should import stringlit.d.ts") {
      testTsFile("stringlit.d.ts")
    }
    test("should import then.d.ts") {
      testTsFile("then.d.ts")
    }
    test("should import thistype.d.ts") {
      testTsFile("thistype.d.ts")
    }
    test("should import uniontype.d.ts") {
      testTsFile("uniontype.d.ts")
    }
  }
}
