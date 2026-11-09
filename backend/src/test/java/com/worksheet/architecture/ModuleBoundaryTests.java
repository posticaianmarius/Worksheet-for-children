package com.worksheet.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.*;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

import org.springframework.data.repository.Repository;

@AnalyzeClasses(packages = "com.worksheet", importOptions = ImportOption.DoNotIncludeTests.class)
class ModuleBoundaryTests {
    @ArchTest
    static final ArchRule entityStateIsEncapsulated =
            fields().that()
                    .areDeclaredInClassesThat()
                    .areAnnotatedWith(jakarta.persistence.Entity.class)
                    .and()
                    .areNotStatic()
                    .should()
                    .notBePublic();

    @ArchTest
    static final ArchRule acyclicModules =
            slices().matching("com.worksheet.(*)..").should().beFreeOfCycles();

    @ArchTest
    static final ArchRule compositionIsOuter =
            noClasses()
                    .that()
                    .resideOutsideOfPackage("com.worksheet.application..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("com.worksheet.application..");

    @ArchTest
    static final ArchRule teachingOwnsNoLearning =
            noClasses()
                    .that()
                    .resideInAPackage("com.worksheet.teaching..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("com.worksheet.learning..", "com.worksheet.content..");

    @ArchTest
    static final ArchRule catalogUsesReferencePort =
            noClasses()
                    .that()
                    .resideInAPackage("com.worksheet.content.catalog..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("com.worksheet.content.worksheet..");

    @ArchTest
    static final ArchRule repositoriesStayPrivate =
            classes()
                    .that()
                    .areAssignableTo(Repository.class)
                    .should(
                            new ArchCondition<JavaClass>(
                                    "only be used inside their owning module") {
                                public void check(JavaClass repository, ConditionEvents events) {
                                    String owner = module(repository);
                                    repository
                                            .getDirectDependenciesToSelf()
                                            .forEach(
                                                    dependency -> {
                                                        JavaClass caller =
                                                                dependency.getOriginClass();
                                                        if (caller.getName()
                                                                        .startsWith(
                                                                                "com.worksheet.")
                                                                && !owner.equals(module(caller))) {
                                                            events.add(
                                                                    SimpleConditionEvent.violated(
                                                                            caller,
                                                                            dependency
                                                                                    .getDescription()));
                                                        }
                                                    });
                                }
                            });

    private static String module(JavaClass type) {
        return type.getPackageName().substring("com.worksheet.".length()).split("\\.")[0];
    }
}
